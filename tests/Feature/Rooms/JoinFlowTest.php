<?php

namespace Tests\Feature\Rooms;

use App\Enums\RoomEventType;
use App\Libraries\LiveKit\LiveKitClient;
use App\Models\Guest;
use App\Models\Room;
use App\Models\RoomEvent;
use App\Models\RoomLink;
use App\Models\RoomParticipant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;
use Tests\TestCase;

class JoinFlowTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private RoomLink $link;

    /**
     * A live room for 200 people with an active share link.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::factory()->live()->create(['max_participants' => 200]);
        $this->link = RoomLink::factory()->for($this->room)->create();
    }

    /**
     * Stand in for LiveKit with a room holding the given number of participants.
     *
     * @param  (callable(MockInterface): void)|null  $expectToken
     */
    private function liveKit(int $connected = 0, ?callable $expectToken = null): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) use ($connected, $expectToken) {
            $mock->shouldReceive('createRoom')->with($this->room->livekit_room_name, 201);
            $mock->shouldReceive('countParticipants')->andReturn($connected);
            $mock->shouldReceive('publicUrl')->andReturn('wss://livekit.test');

            if ($expectToken !== null) {
                $expectToken($mock);
            } else {
                $mock->shouldReceive('generateToken')->andReturn('viewer-token');
            }
        });
    }

    /**
     * Join the test room as the given person.
     */
    private function join(string $name = 'Ada Lovelace', string $email = 'ada@example.com'): TestResponse
    {
        return $this->post(route('join.store', $this->link), ['name' => $name, 'email' => $email]);
    }

    public function test_joining_records_the_guest_and_goes_into_the_room(): void
    {
        $this->join()->assertRedirect(route('join.room', $this->link));

        $guest = Guest::query()->sole();
        $this->assertSame('ada@example.com', $guest->email);

        $participant = RoomParticipant::query()->sole();
        $this->assertSame('Ada Lovelace', $participant->name);
        $this->assertTrue($participant->room->is($this->room));
        $this->assertTrue($participant->link->is($this->link));
        $this->assertSame(RoomEventType::Joined, RoomEvent::query()->sole()->type);
    }

    public function test_a_returning_email_reuses_the_guest_and_takes_the_new_name(): void
    {
        $this->join('Ada', 'ADA@example.com');
        $this->join('Ada Lovelace', 'ada@example.com');

        $this->assertSame(1, Guest::query()->count());
        $this->assertSame(1, RoomParticipant::query()->count());
        $this->assertSame('Ada Lovelace', Guest::query()->sole()->name);
        $this->assertSame('Ada Lovelace', RoomParticipant::query()->sole()->name);
        $this->assertSame(1, RoomEvent::query()->count());
    }

    public function test_name_and_email_are_required(): void
    {
        $this->post(route('join.store', $this->link), ['name' => '', 'email' => 'not-an-email'])
            ->assertSessionHasErrors(['name', 'email']);

        $this->assertSame(0, Guest::query()->count());
    }

    public function test_an_expired_link_lets_nobody_in(): void
    {
        $this->link->update(['expires_at' => now()->subMinute()]);

        $this->join()->assertRedirect(route('join.show', $this->link));

        $this->assertSame(0, RoomParticipant::query()->count());
    }

    public function test_a_removed_guest_cannot_rejoin(): void
    {
        $guest = Guest::factory()->create(['email' => 'ada@example.com']);
        RoomParticipant::factory()->for($this->room)->for($guest)->removed()->create();

        $this->from(route('join.show', $this->link))
            ->join()
            ->assertRedirect(route('join.show', $this->link))
            ->assertSessionHasErrors('email');
    }

    public function test_the_room_page_grants_a_view_only_token(): void
    {
        $this->join();
        $participant = RoomParticipant::query()->sole();

        $this->liveKit(expectToken: function (MockInterface $mock) use ($participant) {
            $mock->shouldReceive('generateToken')->once()->withArgs(
                fn (string $roomName, string $participantIdentity, string $participantName, bool $canPublish, bool $canSubscribe, bool $canPublishData, array $canPublishSources) => $participantIdentity === $participant->uuid
                    && $participantName === 'Ada Lovelace'
                    && ! $canPublish
                    && ! $canPublishData
                    && $canPublishSources === [],
            )->andReturn('viewer-token');
        });

        $this->get(route('join.room', $this->link))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('join/room')
                ->where('participant.uuid', $participant->uuid)
                ->where('participant.hand_raised', false)
                ->where('access.connection.token', 'viewer-token')
                ->where('access.refusal', null));
    }

    public function test_a_speaker_who_rejoins_can_publish_again(): void
    {
        $this->join();
        RoomParticipant::query()->sole()->update(['promoted_at' => now()]);

        $this->liveKit(expectToken: function (MockInterface $mock) {
            $mock->shouldReceive('generateToken')->once()->withArgs(
                fn (string $roomName, string $participantIdentity, string $participantName, bool $canPublish, bool $canSubscribe, bool $canPublishData, array $canPublishSources) => $canPublish
                    && $canPublishSources === ['camera', 'microphone'],
            )->andReturn('speaker-token');
        });

        $this->get(route('join.room', $this->link))
            ->assertInertia(fn (Assert $page) => $page->where('access.connection.token', 'speaker-token'));
    }

    public function test_the_room_page_needs_a_join_first(): void
    {
        $this->get(route('join.room', $this->link))->assertRedirect(route('join.show', $this->link));
    }

    public function test_a_full_room_is_refused_in_place(): void
    {
        $this->join();
        $this->liveKit(connected: 201);

        $this->get(route('join.room', $this->link))
            ->assertInertia(fn (Assert $page) => $page
                ->where('access.connection', null)
                ->where('access.refusal', 'full'));
    }

    public function test_a_removed_participant_gets_no_token(): void
    {
        $this->join();
        RoomParticipant::query()->sole()->update(['removed_at' => now()]);
        $this->liveKit();

        $this->get(route('join.room', $this->link))
            ->assertInertia(fn (Assert $page) => $page->where('access.refusal', 'removed'));
    }

    public function test_a_returning_browser_sees_its_details_prefilled(): void
    {
        $this->join();

        $this->get(route('join.show', $this->link))
            ->assertInertia(fn (Assert $page) => $page
                ->component('join/show')
                ->where('returning.name', 'Ada Lovelace')
                ->where('returning.email', 'ada@example.com'));
    }

    public function test_only_someone_who_joined_can_raise_a_hand(): void
    {
        $this->post(route('join.hand', $this->link), ['raised' => true])->assertForbidden();
    }
}
