<?php

namespace App\Services\Rooms;

use App\Enums\RoomStatus;
use App\Models\Room;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use LogicException;

class RoomService
{
    /**
     * Create a scheduled room. With a single host for now, the creator also hosts it.
     *
     * The LiveKit room itself is not created here: that happens lazily on the
     * first join (SPEC §5), so only its name is reserved.
     *
     * @param  array{title: string, description?: string|null, max_participants: int, max_speakers: int, starts_at: string, ends_at: string}  $data
     */
    public function create(User $creator, array $data): Room
    {
        return DB::transaction(function () use ($creator, $data): Room {
            $room = new Room;
            $room->uuid = $room->newUniqueId();

            $room->fill([
                ...$data,
                'host_id' => $creator->getKey(),
                'created_by' => $creator->getKey(),
                'status' => RoomStatus::Scheduled,
                'livekit_room_name' => 'room-'.Str::lower($room->uuid),
            ])->save();

            return $room;
        });
    }

    /**
     * Update a room's details. Schedule and capacity only change while it is still scheduled.
     *
     * @param  array{title?: string, description?: string|null, max_participants?: int, max_speakers?: int, starts_at?: string, ends_at?: string}  $data
     *
     * @throws LogicException when scheduling fields are given for a room that is no longer scheduled
     */
    public function update(Room $room, array $data): Room
    {
        return DB::transaction(function () use ($room, $data): Room {
            $locked = Room::query()->whereKey($room->getKey())->lockForUpdate()->firstOrFail();

            $schedulingFields = ['max_participants', 'max_speakers', 'starts_at', 'ends_at'];

            if (! $locked->status->isSchedulingEditable() && array_intersect($schedulingFields, array_keys($data)) !== []) {
                throw new LogicException('Scheduling fields can only change while the room is scheduled.');
            }

            $locked->fill($data)->save();

            return $locked;
        });
    }

    /**
     * Soft-delete a room that is not live.
     *
     * @throws LogicException when the room is live
     */
    public function delete(Room $room): void
    {
        DB::transaction(function () use ($room): void {
            $locked = Room::query()->whereKey($room->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->status->isDeletable()) {
                throw new LogicException('A live room has to be ended before it can be deleted.');
            }

            $locked->delete();
        });
    }
}
