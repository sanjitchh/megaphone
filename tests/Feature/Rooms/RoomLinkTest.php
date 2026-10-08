<?php

namespace Tests\Feature\Rooms;

use App\Enums\RoomStatus;
use App\Models\Room;
use App\Models\RoomLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RoomLinkTest extends TestCase
{
    use RefreshDatabase;

    private User $host;

    private Room $room;

    /**
     * A scheduled room owned by the host, tomorrow 10:00–11:00.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->host = User::factory()->create();
        $startsAt = now()->addDay()->setTime(10, 0);
        $this->room = Room::factory()->for($this->host, 'host')->create([
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addHour(),
        ]);
    }

    /**
     * The scoped route parameters for a link of the test room.
     *
     * @return array{room: Room, link: RoomLink}
     */
    private function linkParams(RoomLink $link): array
    {
        return ['room' => $this->room, 'link' => $link];
    }

    public function test_guests_cannot_manage_links(): void
    {
        $link = RoomLink::factory()->for($this->room)->create();

        $this->post(route('rooms.links.store', $this->room))->assertRedirect(route('login'));
        $this->post(route('rooms.links.revoke', $this->linkParams($link)))->assertRedirect(route('login'));
    }

    public function test_a_link_defaults_to_expiring_at_the_rooms_scheduled_end(): void
    {
        $this->actingAs($this->host)
            ->from(route('rooms.edit', $this->room))
            ->post(route('rooms.links.store', $this->room), ['label' => 'Newsletter'])
            ->assertRedirect(route('rooms.edit', $this->room))
            ->assertInertiaFlash('toast.type', 'success');

        $link = $this->room->links()->sole();

        $this->assertSame('Newsletter', $link->label);
        $this->assertTrue($link->expires_at->equalTo($this->room->ends_at));
        $this->assertSame($this->host->id, $link->created_by);
        $this->assertMatchesRegularExpression('/^[a-km-z2-9]{24}$/', $link->slug);
        $this->assertNotNull($link->uuid);
        $this->assertSame(1, $link->audits()->count());
    }

    public function test_a_link_can_be_given_its_own_expiry(): void
    {
        $expiresAt = now()->addDays(3)->startOfMinute();

        $this->actingAs($this->host)
            ->post(route('rooms.links.store', $this->room), ['expires_at' => $expiresAt->toIso8601String()]);

        $this->assertTrue($this->room->links()->sole()->expires_at->equalTo($expiresAt));
    }

    public function test_a_link_cannot_expire_in_the_past(): void
    {
        $this->actingAs($this->host)
            ->post(route('rooms.links.store', $this->room), ['expires_at' => now()->subMinute()->toIso8601String()])
            ->assertSessionHasErrors('expires_at');

        $this->assertSame(0, $this->room->links()->count());
    }

    public function test_the_default_expiry_is_refused_once_the_scheduled_end_has_passed(): void
    {
        $this->room->update(['status' => RoomStatus::Live, 'ends_at' => now()->subMinute()]);

        $this->actingAs($this->host)
            ->post(route('rooms.links.store', $this->room))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertSame(0, $this->room->links()->count());
    }

    public function test_finished_rooms_do_not_get_new_links(): void
    {
        $this->room->update(['status' => RoomStatus::Ended]);

        $this->actingAs($this->host)
            ->post(route('rooms.links.store', $this->room))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertSame(0, $this->room->links()->count());
    }

    public function test_slugs_are_unique_per_link(): void
    {
        $links = RoomLink::factory()->count(20)->for($this->room)->create();

        $this->assertCount(20, $links->pluck('slug')->unique());
    }

    public function test_the_expiry_can_be_changed_and_reopens_an_expired_link(): void
    {
        $link = RoomLink::factory()->for($this->room)->expired()->create();
        $expiresAt = now()->addDays(2)->startOfMinute();

        $this->actingAs($this->host)
            ->patch(route('rooms.links.update', $this->linkParams($link)), ['expires_at' => $expiresAt->toIso8601String()])
            ->assertInertiaFlash('toast.type', 'success');

        $link->refresh();
        $this->assertTrue($link->expires_at->equalTo($expiresAt));
        $this->assertTrue($link->isActive());
    }

    public function test_a_revoked_links_expiry_cannot_be_changed(): void
    {
        $link = RoomLink::factory()->for($this->room)->revoked()->create();
        $original = $link->expires_at;

        $this->actingAs($this->host)
            ->patch(route('rooms.links.update', $this->linkParams($link)), ['expires_at' => now()->addWeek()->toIso8601String()])
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertTrue($link->refresh()->expires_at->equalTo($original));
    }

    public function test_a_link_can_be_revoked_and_revoking_again_keeps_the_first_time(): void
    {
        $link = RoomLink::factory()->for($this->room)->create();

        $this->actingAs($this->host)->post(route('rooms.links.revoke', $this->linkParams($link)));
        $revokedAt = $link->refresh()->revoked_at;
        $this->assertNotNull($revokedAt);

        $this->travel(5)->minutes();
        $this->actingAs($this->host)->post(route('rooms.links.revoke', $this->linkParams($link)));

        $this->assertTrue($link->refresh()->revoked_at->equalTo($revokedAt));
    }

    public function test_regenerating_revokes_the_old_link_and_keeps_label_and_expiry(): void
    {
        $link = RoomLink::factory()->for($this->room)->create(['label' => 'Partners']);

        $this->actingAs($this->host)
            ->post(route('rooms.links.regenerate', $this->linkParams($link)))
            ->assertInertiaFlash('toast.type', 'success');

        $this->assertNotNull($link->refresh()->revoked_at);

        $new = $this->room->links()->whereKeyNot($link->id)->sole();
        $this->assertNotSame($link->slug, $new->slug);
        $this->assertSame('Partners', $new->label);
        $this->assertTrue($new->expires_at->equalTo($link->expires_at));
        $this->assertTrue($new->isActive());
    }

    public function test_an_expired_link_cannot_be_regenerated(): void
    {
        $link = RoomLink::factory()->for($this->room)->expired()->create();

        $this->actingAs($this->host)
            ->post(route('rooms.links.regenerate', $this->linkParams($link)))
            ->assertInertiaFlash('toast.type', 'error');

        $this->assertSame(1, $this->room->links()->count());
    }

    public function test_a_link_is_only_reachable_through_its_own_room(): void
    {
        $otherRoom = Room::factory()->for($this->host, 'host')->create();
        $link = RoomLink::factory()->for($otherRoom)->create();

        $this->actingAs($this->host)
            ->post(route('rooms.links.revoke', ['room' => $this->room, 'link' => $link]))
            ->assertNotFound();

        $this->assertNull($link->refresh()->revoked_at);
    }

    public function test_the_edit_page_lists_links_active_first(): void
    {
        $revoked = RoomLink::factory()->for($this->room)->revoked()->create();
        $active = RoomLink::factory()->for($this->room)->create();

        $this->actingAs($this->host)
            ->get(route('rooms.edit', $this->room))
            ->assertInertia(fn (Assert $page) => $page
                ->component('rooms/edit')
                ->where('room.can.create_links', true)
                ->has('links', 2)
                ->where('links.0.uuid', $active->uuid)
                ->where('links.0.status', 'ACTIVE')
                ->where('links.0.url', route('join.show', $active->slug))
                ->where('links.0.can', ['change_expiry' => true, 'revoke' => true, 'regenerate' => true])
                ->where('links.1.uuid', $revoked->uuid)
                ->where('links.1.status', 'REVOKED')
                ->where('links.1.can', ['change_expiry' => false, 'revoke' => false, 'regenerate' => false])
                ->missing('links.0.id')
                ->missing('links.0.slug')
            );
    }

    public function test_an_active_link_shows_the_room_to_anyone(): void
    {
        $link = RoomLink::factory()->for($this->room)->create();

        $this->get(route('join.show', $link->slug))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('join/show')
                ->where('room.title', $this->room->title)
                ->where('room.host', $this->host->name)
                ->where('room.status', 'SCHEDULED')
                ->missing('room.uuid')
                ->missing('room.livekit_room_name')
            );
    }

    public function test_expired_revoked_and_orphaned_links_all_read_as_expired(): void
    {
        $expired = RoomLink::factory()->for($this->room)->expired()->create();
        $revoked = RoomLink::factory()->for($this->room)->revoked()->create();
        $deletedRoom = Room::factory()->for($this->host, 'host')->create();
        $orphaned = RoomLink::factory()->for($deletedRoom)->create();
        $deletedRoom->delete();

        foreach ([$expired, $revoked, $orphaned] as $link) {
            $this->get(route('join.show', $link->slug))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('join/unavailable')
                    ->where('reason', 'expired')
                    ->missing('title')
                );
        }
    }

    public function test_links_to_finished_rooms_say_the_webinar_is_over(): void
    {
        $link = RoomLink::factory()->for($this->room)->create();

        $this->room->update(['status' => RoomStatus::Ended]);
        $this->get(route('join.show', $link->slug))
            ->assertInertia(fn (Assert $page) => $page->component('join/unavailable')->where('reason', 'ended'));

        $this->room->update(['status' => RoomStatus::Cancelled]);
        $this->get(route('join.show', $link->slug))
            ->assertInertia(fn (Assert $page) => $page->component('join/unavailable')->where('reason', 'cancelled'));
    }

    public function test_unknown_slugs_are_not_found(): void
    {
        $this->get('/r/doesnotexist')->assertNotFound();
    }

    public function test_opening_links_is_rate_limited_per_ip(): void
    {
        config(['megaphone.links.join_rate_limit' => 2]);
        $link = RoomLink::factory()->for($this->room)->create();

        $this->get(route('join.show', $link->slug))->assertOk();
        $this->get(route('join.show', $link->slug))->assertOk();
        $this->get(route('join.show', $link->slug))->assertTooManyRequests();
    }
}
