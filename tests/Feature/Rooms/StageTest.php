<?php

namespace Tests\Feature\Rooms;

use App\Enums\RoomEventType;
use App\Events\StageChanged;
use App\Libraries\LiveKit\LiveKitClient;
use App\Models\Room;
use App\Models\RoomEvent;
use App\Models\RoomLink;
use App\Models\RoomParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class StageTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private Room $room;

    private RoomParticipant $participant;

    /**
     * A live room with a stage for two, and one participant in it.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Event::fake([StageChanged::class]);

        $this->host = User::factory()->create();
        $this->room = Room::factory()->for($this->host, 'host')->live()->create(['max_speakers' => 2]);
        $this->participant = RoomParticipant::factory()->for($this->room)->create(['name' => 'Ada']);
    }

    /**
     * The scoped route parameters for a participant of the test room.
     *
     * @return array{room: Room, participant: RoomParticipant}
     */
    private function params(?RoomParticipant $participant = null): array
    {
        return ['room' => $this->room, 'participant' => $participant ?? $this->participant];
    }

    /**
     * Join the test room as the test participant, in this browser's session.
     */
    private function actAsParticipant(): RoomLink
    {
        $link = RoomLink::factory()->for($this->room)->create();
        $this->withSession(['joined_rooms.'.$this->room->uuid => $this->participant->uuid]);

        return $link;
    }

    public function test_a_participant_raises_and_lowers_their_hand(): void
    {
        $link = $this->actAsParticipant();

        $this->post(route('join.hand', $link), ['raised' => true])->assertRedirect(route('join.room', $link));
        $this->assertNotNull($this->participant->refresh()->hand_raised_at);
        Event::assertDispatched(StageChanged::class, fn (StageChanged $event) => $event->type === RoomEventType::HandRaised);

        $this->post(route('join.hand', $link), ['raised' => false]);
        $this->assertNull($this->participant->refresh()->hand_raised_at);

        $this->assertSame(
            [RoomEventType::HandRaised, RoomEventType::HandLowered],
            RoomEvent::query()->orderBy('id')->pluck('type')->all(),
        );
    }

    public function test_raising_a_hand_twice_is_one_raise(): void
    {
        $link = $this->actAsParticipant();

        $this->post(route('join.hand', $link), ['raised' => true]);
        $raisedAt = $this->participant->refresh()->hand_raised_at;

        $this->travel(5)->seconds();
        $this->post(route('join.hand', $link), ['raised' => true]);

        $this->assertTrue($this->participant->refresh()->hand_raised_at->equalTo($raisedAt));
        $this->assertSame(1, RoomEvent::query()->count());
        Event::assertDispatchedTimes(StageChanged::class, 1);
    }

    public function test_hands_only_go_up_while_the_room_is_live(): void
    {
        $this->room->update(['status' => 'SCHEDULED']);
        $link = $this->actAsParticipant();

        $this->post(route('join.hand', $link), ['raised' => true])->assertInertiaFlash('toast.type', 'error');

        $this->assertNull($this->participant->refresh()->hand_raised_at);
    }

    public function test_the_host_lowers_a_hand_and_the_participant_is_told(): void
    {
        $this->participant->update(['hand_raised_at' => now()]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('sendData')->once()->with(
                $this->room->livekit_room_name,
                '{"type":"hand.lowered"}',
                [$this->participant->uuid],
                'megaphone',
            );
        });

        $this->actingAs($this->host)
            ->post(route('rooms.participants.lower-hand', $this->params()))
            ->assertRedirect(route('rooms.studio', $this->room));

        $this->assertNull($this->participant->refresh()->hand_raised_at);
        $this->assertTrue(RoomEvent::query()->sole()->user_id === $this->host->id);
    }

    public function test_promoting_grants_camera_and_mic_and_lowers_the_hand(): void
    {
        $this->participant->update(['hand_raised_at' => now()]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('updateParticipantPermissions')->once()->withArgs(
                fn (string $room, string $identity, bool $canPublish, array $sources) => $identity === $this->participant->uuid
                    && $canPublish
                    && $sources === ['camera', 'microphone'],
            )->andReturn(true);
        });

        $this->actingAs($this->host)
            ->post(route('rooms.participants.promote', $this->params()))
            ->assertInertiaFlash('toast.type', 'success');

        $this->participant->refresh();
        $this->assertNotNull($this->participant->promoted_at);
        $this->assertNull($this->participant->hand_raised_at);
        Event::assertDispatched(StageChanged::class, fn (StageChanged $event) => $event->type === RoomEventType::SpeakerPromoted);
    }

    public function test_the_stage_holds_at_most_max_speakers(): void
    {
        RoomParticipant::factory()->for($this->room)->speaker()->count(2)->create();

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('updateParticipantPermissions');
        });

        $this->actingAs($this->host)
            ->post(route('rooms.participants.promote', $this->params()))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertNull($this->participant->refresh()->promoted_at);
    }

    public function test_someone_who_left_cannot_be_promoted(): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('updateParticipantPermissions')->andReturn(false);
        });

        $this->actingAs($this->host)
            ->post(route('rooms.participants.promote', $this->params()))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertNull($this->participant->refresh()->promoted_at);
        $this->assertSame(0, RoomEvent::query()->count());
    }

    public function test_nothing_changes_when_livekit_is_unreachable(): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('updateParticipantPermissions')->andThrow(new RuntimeException('Connection refused'));
        });

        $this->actingAs($this->host)
            ->post(route('rooms.participants.promote', $this->params()))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertNull($this->participant->refresh()->promoted_at);
        Event::assertNotDispatched(StageChanged::class);
    }

    public function test_demoting_takes_away_publishing(): void
    {
        $this->participant->update(['promoted_at' => now()]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('updateParticipantPermissions')->once()->withArgs(
                fn (string $room, string $identity, bool $canPublish) => ! $canPublish,
            )->andReturn(true);
        });

        $this->actingAs($this->host)->post(route('rooms.participants.demote', $this->params()));

        $this->assertNull($this->participant->refresh()->promoted_at);
    }

    public function test_removing_disconnects_and_clears_their_state(): void
    {
        $this->participant->update(['promoted_at' => now()]);

        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('removeParticipant')->once()->with($this->room->livekit_room_name, $this->participant->uuid);
        });

        $this->actingAs($this->host)
            ->post(route('rooms.participants.remove', $this->params()))
            ->assertInertiaFlash('toast.type', 'success');

        $this->participant->refresh();
        $this->assertTrue($this->participant->isRemoved());
        $this->assertNull($this->participant->promoted_at);
    }

    public function test_only_the_host_moderates(): void
    {
        $other = User::factory()->create();

        $this->actingAs($other)->post(route('rooms.participants.promote', $this->params()))->assertForbidden();
        $this->actingAs($other)->post(route('rooms.participants.remove', $this->params()))->assertForbidden();
    }

    public function test_participants_of_another_room_are_out_of_reach(): void
    {
        $stranger = RoomParticipant::factory()->create();

        $this->actingAs($this->host)
            ->post(route('rooms.participants.remove', $this->params($stranger)))
            ->assertNotFound();
    }

    public function test_the_studio_lists_hands_and_speakers(): void
    {
        $this->mock(LiveKitClient::class, function (MockInterface $mock) {
            $mock->shouldReceive('createRoom');
            $mock->shouldReceive('publicUrl')->andReturn('wss://livekit.test');
            $mock->shouldReceive('generateToken')->andReturn('host-token');
        });

        $this->participant->update(['hand_raised_at' => now()]);
        $speaker = RoomParticipant::factory()->for($this->room)->speaker()->create();
        RoomParticipant::factory()->for($this->room)->removed()->create(['hand_raised_at' => now()]);

        $this->actingAs($this->host)
            ->get(route('rooms.studio', $this->room))
            ->assertInertia(fn (Assert $page) => $page
                ->has('stage.hands', 1)
                ->where('stage.hands.0.uuid', $this->participant->uuid)
                ->has('stage.speakers', 1)
                ->where('stage.speakers.0.uuid', $speaker->uuid));
    }
}
