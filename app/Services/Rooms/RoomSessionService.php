<?php

namespace App\Services\Rooms;

use App\Enums\RoomStatus;
use App\Libraries\LiveKit\LiveKitClient;
use App\Models\Room;
use Illuminate\Support\Facades\DB;
use LogicException;
use Throwable;

class RoomSessionService
{
    /**
     * What the host may publish (SPEC §5): camera, mic and screen share with its audio.
     *
     * @var list<string>
     */
    private const array HOST_SOURCES = ['camera', 'microphone', 'screen_share', 'screen_share_audio'];

    /**
     * Create a room session service.
     */
    public function __construct(private LiveKitClient $liveKit) {}

    /**
     * Start broadcasting. The schedule is informational, so a room can go live early or late.
     *
     * @throws LogicException when the room is not scheduled
     */
    public function goLive(Room $room): Room
    {
        return DB::transaction(function () use ($room): Room {
            $locked = Room::query()->whereKey($room->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->status->canGoLive()) {
                throw new LogicException('Only a scheduled room can go live.');
            }

            $locked->update(['status' => RoomStatus::Live, 'started_at' => now()]);

            return $locked;
        });
    }

    /**
     * End the session for everyone. Closing the LiveKit room disconnects whoever is still in it.
     *
     * @throws LogicException when the room is not live
     */
    public function end(Room $room): Room
    {
        $ended = DB::transaction(function () use ($room): Room {
            $locked = Room::query()->whereKey($room->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->status->canEnd()) {
                throw new LogicException('Only a live room can be ended.');
            }

            $locked->update(['status' => RoomStatus::Ended, 'ended_at' => now()]);

            return $locked;
        });

        // Outside the transaction: the room is ended either way. If LiveKit cannot be reached,
        // its empty timeout closes the room once everyone has left, and no new tokens are issued.
        try {
            $this->liveKit->deleteRoom($ended->livekit_room_name);
        } catch (Throwable $e) {
            report($e);
        }

        return $ended;
    }

    /**
     * Make sure the LiveKit room exists and grant the host a token to join it.
     *
     * The LiveKit room is created lazily on the first join and recreated if its empty
     * timeout closed it (SPEC §5). Its cap leaves one seat for the host on top of the audience.
     *
     * @return array{server_url: string, token: string}
     *
     * @throws LogicException when the room has finished
     */
    public function hostConnection(Room $room): array
    {
        if (! $room->status->hasStudio()) {
            throw new LogicException('This room has finished.');
        }

        $room->loadMissing('host');

        $this->liveKit->createRoom($room->livekit_room_name, $room->max_participants + 1);

        return [
            'server_url' => $this->liveKit->publicUrl(),
            'token' => $this->liveKit->generateToken(
                roomName: $room->livekit_room_name,
                participantIdentity: $room->host->uuid,
                participantName: $room->host->name,
                canPublishSources: self::HOST_SOURCES,
                roomAdmin: true,
                metadata: (string) json_encode(['role' => 'host']),
            ),
        ];
    }
}
