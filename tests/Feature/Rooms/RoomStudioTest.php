<?php

namespace Tests\Feature\Rooms;

use App\Enums\RoomStatus;
use App\Libraries\LiveKit\LiveKitClient;
use App\Models\Room;
use App\Models\RoomLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class RoomStudioTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private Room $room;

    /**
     * A scheduled room for 200 people, owned by the host.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->host = User::factory()->create();
        $this->room = Room::factory()->for($this->host, 'host')->create(['max_participants' => 200]);
    }

    /**
     * Stand in for LiveKit, expecting the room to be created and a token issued.
     */
    private function expectHostConnection(): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('createRoom')->once()->with($this->room->livekit_room_name, 201);
            $mock->shouldReceive('publicUrl')->andReturn('wss://livekit.test');
            $mock->shouldReceive('generateToken')->once()->withArgs(
                fn (string $roomName, string $participantIdentity, string $participantName, bool $canPublish, bool $canSubscribe, bool $canPublishData, array $canPublishSources, bool $roomAdmin) => $roomName === $this->room->livekit_room_name
                    && $participantIdentity === $this->host->uuid
                    && $canPublishSources === ['camera', 'microphone', 'screen_share', 'screen_share_audio']
                    && $roomAdmin,
            )->andReturn('host-token');
        });
    }

    public function test_guests_cannot_use_the_studio(): void
    {
        $this->get(route('rooms.studio', $this->room))->assertRedirect(route('login'));
        $this->post(route('rooms.live', $this->room))->assertRedirect(route('login'));
        $this->post(route('rooms.end', $this->room))->assertRedirect(route('login'));
    }

    public function test_only_the_host_can_use_the_studio(): void
    {
        $other = User::factory()->create();

        $this->actingAs($other)->get(route('rooms.studio', $this->room))->assertForbidden();
        $this->actingAs($other)->post(route('rooms.live', $this->room))->assertForbidden();
        $this->actingAs($other)->post(route('rooms.end', $this->room))->assertForbidden();
    }

    public function test_the_studio_creates_the_livekit_room_and_grants_the_host_a_token(): void
    {
        $this->expectHostConnection();

        $this->actingAs($this->host)
            ->get(route('rooms.studio', $this->room))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rooms/studio')
                ->where('room.uuid', $this->room->uuid)
                ->where('room.can.go_live', true)
                ->where('connection.server_url', 'wss://livekit.test')
                ->where('connection.token', 'host-token'));
    }

    public function test_the_studio_still_opens_when_livekit_is_unreachable(): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('createRoom')->andThrow(new RuntimeException('Connection refused'));
        });

        $this->actingAs($this->host)
            ->get(route('rooms.studio', $this->room))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('connection', null));
    }

    public function test_a_finished_room_shows_the_session_as_over_without_a_connection(): void
    {
        $this->room->update(['status' => RoomStatus::Ended]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('createRoom');
        });

        $this->actingAs($this->host)
            ->get(route('rooms.studio', $this->room))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rooms/studio')
                ->where('room.status', RoomStatus::Ended->value)
                ->where('connection', null));
    }

    public function test_the_studio_lists_only_active_links(): void
    {
        $this->expectHostConnection();

        $active = RoomLink::factory()->for($this->room)->create(['label' => 'Newsletter']);
        RoomLink::factory()->for($this->room)->revoked()->create();
        RoomLink::factory()->for($this->room)->expired()->create();

        $this->actingAs($this->host)
            ->get(route('rooms.studio', $this->room))
            ->assertInertia(fn (Assert $page) => $page
                ->has('links', 1)
                ->where('links.0.uuid', $active->uuid));
    }

    public function test_the_host_can_go_live(): void
    {
        $this->freezeSecond();

        $this->actingAs($this->host)
            ->post(route('rooms.live', $this->room))
            ->assertRedirect(route('rooms.studio', $this->room))
            ->assertInertiaFlash('toast.type', 'success');

        $this->room->refresh();
        $this->assertSame(RoomStatus::Live, $this->room->status);
        $this->assertTrue($this->room->started_at->equalTo(now()));
    }

    public function test_a_room_cannot_go_live_twice(): void
    {
        $this->freezeSecond();
        $this->room->update(['status' => RoomStatus::Live, 'started_at' => now()->subHour()]);

        $this->actingAs($this->host)
            ->post(route('rooms.live', $this->room))
            ->assertRedirect(route('rooms.studio', $this->room))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertTrue($this->room->refresh()->started_at->equalTo(now()->subHour()));
    }

    public function test_ending_the_session_closes_the_livekit_room(): void
    {
        $this->room->update(['status' => RoomStatus::Live, 'started_at' => now()->subHour()]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('deleteRoom')->once()->with($this->room->livekit_room_name);
        });

        $this->actingAs($this->host)
            ->post(route('rooms.end', $this->room))
            ->assertRedirect(route('rooms.studio', $this->room))
            ->assertInertiaFlash('toast.type', 'success');

        $this->room->refresh();
        $this->assertSame(RoomStatus::Ended, $this->room->status);
        $this->assertNotNull($this->room->ended_at);
    }

    public function test_the_session_ends_even_when_livekit_is_unreachable(): void
    {
        $this->room->update(['status' => RoomStatus::Live, 'started_at' => now()->subHour()]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('deleteRoom')->andThrow(new RuntimeException('Connection refused'));
        });

        $this->actingAs($this->host)
            ->post(route('rooms.end', $this->room))
            ->assertRedirect(route('rooms.studio', $this->room));

        $this->assertSame(RoomStatus::Ended, $this->room->refresh()->status);
    }

    public function test_only_a_live_room_can_be_ended(): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('deleteRoom');
        });

        $this->actingAs($this->host)
            ->from(route('rooms.studio', $this->room))
            ->post(route('rooms.end', $this->room))
            ->assertRedirect(route('rooms.studio', $this->room))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertSame(RoomStatus::Scheduled, $this->room->refresh()->status);
    }
}
