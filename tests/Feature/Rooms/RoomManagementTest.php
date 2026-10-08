<?php

namespace Tests\Feature\Rooms;

use App\Enums\RoomStatus;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RoomManagementTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A valid store/update payload, starting tomorrow.
     *
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        $startsAt = now()->addDay()->startOfHour();

        return [
            'title' => 'Quarterly all-hands',
            'description' => 'Numbers, roadmap, Q&A.',
            'max_participants' => 500,
            'max_speakers' => 4,
            'starts_at' => $startsAt->toIso8601String(),
            'ends_at' => $startsAt->addHour()->toIso8601String(),
            ...$overrides,
        ];
    }

    public function test_guests_are_redirected_to_the_login_page(): void
    {
        $this->get(route('rooms.index'))->assertRedirect(route('login'));
        $this->post(route('rooms.store'), $this->payload())->assertRedirect(route('login'));
    }

    public function test_the_index_lists_upcoming_rooms_before_finished_ones(): void
    {
        $host = User::factory()->create();
        $ended = Room::factory()->ended()->for($host, 'host')->create(['starts_at' => now()->subDay(), 'ends_at' => now()->subDay()->addHour()]);
        $later = Room::factory()->for($host, 'host')->create(['starts_at' => now()->addDays(5)]);
        $sooner = Room::factory()->for($host, 'host')->create(['starts_at' => now()->addDay()]);

        $this->actingAs($host)
            ->get(route('rooms.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rooms/index')
                ->has('rooms.data', 3)
                ->where('rooms.data.0.uuid', $sooner->uuid)
                ->where('rooms.data.1.uuid', $later->uuid)
                ->where('rooms.data.2.uuid', $ended->uuid)
                ->missing('rooms.data.0.id')
            );
    }

    public function test_the_create_form_receives_the_capacity_options(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('rooms.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('rooms/create')
                ->where('options.capacities', [200, 500])
                ->where('options.default_max_speakers', 4)
            );
    }

    public function test_a_room_is_created_scheduled_and_hosted_by_its_creator(): void
    {
        $host = User::factory()->create();

        $response = $this->actingAs($host)->post(route('rooms.store'), $this->payload());

        $room = Room::query()->sole();
        $response->assertRedirect(route('rooms.edit', $room));

        $this->assertSame('Quarterly all-hands', $room->title);
        $this->assertSame(RoomStatus::Scheduled, $room->status);
        $this->assertSame(500, $room->max_participants);
        $this->assertTrue($room->host->is($host));
        $this->assertTrue($room->creator->is($host));
        $this->assertSame('room-'.$room->uuid, $room->livekit_room_name);
    }

    public function test_room_creation_is_audited(): void
    {
        $this->actingAs(User::factory()->create())->post(route('rooms.store'), $this->payload());

        $this->assertDatabaseHas('audits', [
            'auditable_type' => Room::class,
            'auditable_id' => Room::query()->sole()->id,
            'event' => 'created',
        ]);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing title' => [['title' => ''], 'title'],
            'capacity not offered' => [['max_participants' => 300], 'max_participants'],
            'stage limit too high' => [['max_speakers' => 9], 'max_speakers'],
            'negative stage limit' => [['max_speakers' => -1], 'max_speakers'],
            'start in the past' => [['starts_at' => '2020-01-01T10:00:00Z'], 'starts_at'],
            'end before start' => [['ends_at' => '2020-01-01T10:00:00Z'], 'ends_at'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[DataProvider('invalidPayloads')]
    public function test_invalid_rooms_are_rejected(array $overrides, string $field): void
    {
        $this->actingAs(User::factory()->create())
            ->post(route('rooms.store'), $this->payload($overrides))
            ->assertSessionHasErrors($field);

        $this->assertDatabaseCount('rooms', 0);
    }

    public function test_a_scheduled_room_can_be_updated(): void
    {
        $room = Room::factory()->create();

        $this->actingAs($room->host)
            ->put(route('rooms.update', $room), $this->payload(['title' => 'Renamed', 'max_participants' => 200]))
            ->assertRedirect(route('rooms.edit', $room));

        $room->refresh();
        $this->assertSame('Renamed', $room->title);
        $this->assertSame(200, $room->max_participants);
    }

    public function test_the_schedule_of_a_room_that_is_no_longer_scheduled_cannot_change(): void
    {
        $room = Room::factory()->live()->create();
        $startsAt = $room->starts_at;

        $this->actingAs($room->host)
            ->put(route('rooms.update', $room), $this->payload())
            ->assertSessionHasErrors(['starts_at', 'ends_at', 'max_participants', 'max_speakers']);

        $this->assertTrue($room->refresh()->starts_at->equalTo($startsAt));
    }

    public function test_the_title_of_a_live_room_can_still_change(): void
    {
        $room = Room::factory()->live()->create();

        $this->actingAs($room->host)
            ->put(route('rooms.update', $room), ['title' => 'Renamed live', 'description' => null])
            ->assertSessionHasNoErrors();

        $this->assertSame('Renamed live', $room->refresh()->title);
    }

    public function test_a_room_is_soft_deleted(): void
    {
        $room = Room::factory()->create();

        $this->actingAs($room->host)
            ->delete(route('rooms.destroy', $room))
            ->assertRedirect(route('rooms.index'));

        $this->assertSoftDeleted($room);
    }

    public function test_a_live_room_cannot_be_deleted(): void
    {
        $room = Room::factory()->live()->create();

        $this->actingAs($room->host)->delete(route('rooms.destroy', $room));

        $this->assertNotSoftDeleted($room);
    }

    public function test_rooms_are_addressed_by_uuid(): void
    {
        $room = Room::factory()->create();

        $this->actingAs($room->host)->get('/rooms/'.$room->id.'/edit')->assertNotFound();
        $this->actingAs($room->host)->get(route('rooms.edit', $room))->assertOk();
    }
}
