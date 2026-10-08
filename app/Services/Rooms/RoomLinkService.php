<?php

namespace App\Services\Rooms;

use App\Models\Room;
use App\Models\RoomLink;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use LogicException;

class RoomLinkService
{
    /**
     * Create a share link. Without an explicit expiry it lasts until the room's scheduled end.
     *
     * @param  array{label?: string|null, expires_at?: string|null}  $data
     *
     * @throws LogicException when the room no longer accepts joins, or the expiry is not in the future
     */
    public function create(Room $room, User $creator, array $data): RoomLink
    {
        return DB::transaction(function () use ($room, $creator, $data): RoomLink {
            $locked = Room::query()->whereKey($room->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->status->acceptsJoins()) {
                throw new LogicException('Links can only be created for scheduled or live rooms.');
            }

            $expiresAt = isset($data['expires_at']) ? Date::parse($data['expires_at']) : $locked->ends_at;

            $this->ensureFuture($expiresAt);

            return $locked->links()->create([
                'created_by' => $creator->getKey(),
                'slug' => RoomLink::newSlug(),
                'label' => $data['label'] ?? null,
                'expires_at' => $expiresAt,
            ]);
        });
    }

    /**
     * Move a link's expiry, which also reopens an expired link. Revoked links stay revoked.
     *
     * @throws LogicException when the link is revoked, the room no longer accepts joins, or the expiry is not in the future
     */
    public function changeExpiry(RoomLink $link, string $expiresAt): RoomLink
    {
        return DB::transaction(function () use ($link, $expiresAt): RoomLink {
            $locked = RoomLink::query()->with('room')->whereKey($link->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->revoked_at !== null) {
                throw new LogicException('A revoked link cannot be changed. Create a new link instead.');
            }

            if (! $locked->room->status->acceptsJoins()) {
                throw new LogicException('Links can only be changed for scheduled or live rooms.');
            }

            $expiry = Date::parse($expiresAt);

            $this->ensureFuture($expiry);

            $locked->update(['expires_at' => $expiry]);

            return $locked;
        });
    }

    /**
     * Stop a link from letting anyone in. Revoking twice keeps the first revocation time.
     */
    public function revoke(RoomLink $link): RoomLink
    {
        return DB::transaction(function () use ($link): RoomLink {
            $locked = RoomLink::query()->whereKey($link->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->revoked_at === null) {
                $locked->update(['revoked_at' => now()]);
            }

            return $locked;
        });
    }

    /**
     * Replace an active link with a new slug (e.g. after it leaked). The old
     * link is revoked; the new one keeps its label and expiry.
     *
     * @throws LogicException when the link is not active or the room no longer accepts joins
     */
    public function regenerate(RoomLink $link, User $creator): RoomLink
    {
        return DB::transaction(function () use ($link, $creator): RoomLink {
            $locked = RoomLink::query()->with('room')->whereKey($link->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->isActive()) {
                throw new LogicException('Only an active link can be regenerated. Create a new link instead.');
            }

            if (! $locked->room->status->acceptsJoins()) {
                throw new LogicException('Links can only be changed for scheduled or live rooms.');
            }

            $locked->update(['revoked_at' => now()]);

            return $locked->room->links()->create([
                'created_by' => $creator->getKey(),
                'slug' => RoomLink::newSlug(),
                'label' => $locked->label,
                'expires_at' => $locked->expires_at,
            ]);
        });
    }

    /**
     * A link born expired would be useless, so the expiry must be ahead of now.
     *
     * @throws LogicException when the expiry is not in the future
     */
    private function ensureFuture(CarbonInterface $expiresAt): void
    {
        if (! $expiresAt->isFuture()) {
            throw new LogicException('The link has to expire in the future.');
        }
    }
}
