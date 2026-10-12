<?php

namespace App\Services\Rooms;

use App\Enums\JoinRefusal;
use App\Enums\RoomEventType;
use App\Enums\RoomStatus;
use App\Exceptions\JoinRefusedException;
use App\Libraries\LiveKit\LiveKitClient;
use App\Models\Guest;
use App\Models\RoomEvent;
use App\Models\RoomLink;
use App\Models\RoomParticipant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RoomJoinService
{
    /**
     * What a promoted participant may publish (SPEC §5): camera and mic, no screen share.
     *
     * @var list<string>
     */
    public const array SPEAKER_SOURCES = ['camera', 'microphone'];

    /**
     * Create a room join service.
     */
    public function __construct(private LiveKitClient $liveKit) {}

    /**
     * Let someone into a room through a share link. A returning email reuses its guest
     * (taking the newly entered name) and, in the same room, its participant record.
     *
     * @throws JoinRefusedException when the link or room no longer lets people in, or the guest was removed
     */
    public function join(RoomLink $link, string $name, string $email): RoomParticipant
    {
        return DB::transaction(function () use ($link, $name, $email): RoomParticipant {
            $link = RoomLink::query()->with('room')->whereKey($link->getKey())->lockForUpdate()->firstOrFail();

            $this->ensureJoinable($link);

            $guest = Guest::query()->createOrFirst(['email' => Str::lower($email)], ['name' => $name]);
            $guest->update(['name' => $name]);

            $participant = RoomParticipant::query()
                ->where('room_id', $link->room_id)
                ->where('guest_id', $guest->getKey())
                ->lockForUpdate()
                ->first();

            if ($participant?->isRemoved()) {
                throw new JoinRefusedException(JoinRefusal::Removed);
            }

            if ($participant !== null) {
                $participant->update(['name' => $name, 'room_link_id' => $link->getKey()]);

                return $participant;
            }

            $participant = RoomParticipant::query()->create([
                'room_id' => $link->room_id,
                'guest_id' => $guest->getKey(),
                'room_link_id' => $link->getKey(),
                'name' => $name,
            ]);

            RoomEvent::record($participant, RoomEventType::Joined, payload: ['link' => $link->uuid]);

            return $participant;
        });
    }

    /**
     * Grant a participant a token for the room. Viewers subscribe only; a participant on
     * stage may also publish their camera and mic, so a rejoin keeps them on stage.
     *
     * The LiveKit room is created lazily here as in the host's studio, and the app refuses a
     * full room before LiveKit has to (its own cap is the same: capacity + the host).
     *
     * @return array{server_url: string, token: string}
     *
     * @throws JoinRefusedException when the room, the link or the participant may no longer join, or the room is full
     */
    public function connection(RoomParticipant $participant, RoomLink $link): array
    {
        $participant->refresh()->load('room');
        $room = $participant->room;

        $this->ensureJoinable($link->setRelation('room', $room));

        if ($participant->isRemoved()) {
            throw new JoinRefusedException(JoinRefusal::Removed);
        }

        $this->liveKit->createRoom($room->livekit_room_name, $room->max_participants + 1);

        if ($this->liveKit->countParticipants($room->livekit_room_name) >= $room->max_participants + 1) {
            throw new JoinRefusedException(JoinRefusal::Full);
        }

        $speaker = $participant->isSpeaker();

        return [
            'server_url' => $this->liveKit->publicUrl(),
            'token' => $this->liveKit->generateToken(
                roomName: $room->livekit_room_name,
                participantIdentity: $participant->uuid,
                participantName: $participant->name,
                canPublish: $speaker,
                canPublishData: false,
                canPublishSources: $speaker ? self::SPEAKER_SOURCES : [],
                metadata: (string) json_encode(['role' => 'student']),
            ),
        ];
    }

    /**
     * A link lets people in while it is active and its room is scheduled or live.
     *
     * @throws JoinRefusedException
     */
    private function ensureJoinable(RoomLink $link): void
    {
        $room = $link->room;

        if ($room === null || ! $link->isActive()) {
            throw new JoinRefusedException(JoinRefusal::Expired);
        }

        if (! $room->status->acceptsJoins()) {
            throw new JoinRefusedException(
                $room->status === RoomStatus::Cancelled ? JoinRefusal::Cancelled : JoinRefusal::Ended,
            );
        }
    }
}
