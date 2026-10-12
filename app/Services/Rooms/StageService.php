<?php

namespace App\Services\Rooms;

use App\Enums\RoomEventType;
use App\Enums\RoomStatus;
use App\Events\StageChanged;
use App\Libraries\LiveKit\LiveKitClient;
use App\Models\Room;
use App\Models\RoomEvent;
use App\Models\RoomParticipant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use LogicException;
use Throwable;

/**
 * Raised hands, the stage and removals (SPEC §4.3). Every change takes a row lock and is
 * idempotent, is logged as a room event, and tells the host's studio once it has committed.
 *
 * Changes LiveKit has to apply (permissions, removal) are made inside the transaction, so
 * if LiveKit refuses or cannot be reached nothing is recorded and the host can try again.
 */
class StageService
{
    /**
     * Data topic participants listen on for messages meant for them alone.
     */
    public const string TOPIC = 'megaphone';

    /**
     * Create a stage service.
     */
    public function __construct(private LiveKitClient $liveKit) {}

    /**
     * Raise or lower a hand. A participant does this for themselves; the host only lowers,
     * and the participant is then told their hand went down.
     *
     * @throws LogicException when raising a hand that cannot be raised
     */
    public function setHand(RoomParticipant $participant, bool $raised, ?User $actor = null): RoomParticipant
    {
        $changed = false;

        $locked = DB::transaction(function () use ($participant, $raised, $actor, &$changed): RoomParticipant {
            $locked = $this->lock($participant);

            if ($raised === ($locked->hand_raised_at !== null)) {
                return $locked;
            }

            if ($raised) {
                $this->ensureLive($locked->room);

                if ($locked->isRemoved() || $locked->isSpeaker()) {
                    throw new LogicException('Only viewers can raise a hand.');
                }
            }

            $locked->update(['hand_raised_at' => $raised ? now() : null]);
            RoomEvent::record($locked, $raised ? RoomEventType::HandRaised : RoomEventType::HandLowered, $actor);
            $changed = true;

            return $locked;
        });

        if ($changed) {
            $this->announce($locked, $raised ? RoomEventType::HandRaised : RoomEventType::HandLowered);

            if ($actor !== null) {
                $this->tell($locked, 'hand.lowered');
            }
        }

        return $locked;
    }

    /**
     * Bring a participant on stage: they may publish their camera and mic, and their hand
     * goes down. The stage holds at most the room's `max_speakers`.
     *
     * @throws LogicException when the room is not live, the stage is full, or they have left
     */
    public function promote(RoomParticipant $participant, User $actor): RoomParticipant
    {
        $changed = false;

        $locked = DB::transaction(function () use ($participant, $actor, &$changed): RoomParticipant {
            // The room row serialises promotions, so two at once cannot both take the last seat.
            $room = Room::query()->whereKey($participant->room_id)->lockForUpdate()->firstOrFail();
            $locked = $this->lock($participant);

            if ($locked->isSpeaker()) {
                return $locked;
            }

            $this->ensureLive($room);

            if ($locked->isRemoved()) {
                throw new LogicException('This person was removed from the room.');
            }

            if ($room->participants()->speakers()->count() >= $room->max_speakers) {
                throw new LogicException(trans_choice('The stage is full (:count speaker).|The stage is full (:count speakers).', $room->max_speakers));
            }

            $handWasRaised = $locked->hand_raised_at !== null;

            $locked->update(['promoted_at' => now(), 'hand_raised_at' => null]);
            RoomEvent::record($locked, RoomEventType::SpeakerPromoted, $actor);

            if ($handWasRaised) {
                RoomEvent::record($locked, RoomEventType::HandLowered, $actor);
            }

            $this->applyPermissions($room, $locked, speaker: true);
            $changed = true;

            return $locked;
        });

        if ($changed) {
            $this->announce($locked, RoomEventType::SpeakerPromoted);
        }

        return $locked;
    }

    /**
     * Take a participant off stage, back to watching.
     *
     * @throws LogicException when LiveKit cannot be reached
     */
    public function demote(RoomParticipant $participant, User $actor): RoomParticipant
    {
        $changed = false;

        $locked = DB::transaction(function () use ($participant, $actor, &$changed): RoomParticipant {
            $locked = $this->lock($participant);

            if (! $locked->isSpeaker()) {
                return $locked;
            }

            $locked->update(['promoted_at' => null]);
            RoomEvent::record($locked, RoomEventType::SpeakerDemoted, $actor);

            // Someone who has already left rejoins as a viewer: their next token reads this row.
            $this->applyPermissions($locked->room, $locked, speaker: false);
            $changed = true;

            return $locked;
        });

        if ($changed) {
            $this->announce($locked, RoomEventType::SpeakerDemoted);
        }

        return $locked;
    }

    /**
     * Remove a participant: they are disconnected, and their email cannot rejoin this room.
     *
     * @throws LogicException when LiveKit cannot be reached
     */
    public function remove(RoomParticipant $participant, User $actor): RoomParticipant
    {
        $changed = false;

        $locked = DB::transaction(function () use ($participant, $actor, &$changed): RoomParticipant {
            $locked = $this->lock($participant);

            if ($locked->isRemoved()) {
                return $locked;
            }

            $locked->update(['removed_at' => now(), 'hand_raised_at' => null, 'promoted_at' => null]);
            RoomEvent::record($locked, RoomEventType::Removed, $actor);

            $this->callLiveKit(fn () => $this->liveKit->removeParticipant($locked->room->livekit_room_name, $locked->uuid));
            $changed = true;

            return $locked;
        });

        if ($changed) {
            $this->announce($locked, RoomEventType::Removed);
        }

        return $locked;
    }

    /**
     * Re-read a participant under a row lock, with its room.
     */
    private function lock(RoomParticipant $participant): RoomParticipant
    {
        return RoomParticipant::query()->with('room')->whereKey($participant->getKey())->lockForUpdate()->firstOrFail();
    }

    /**
     * Hands and the stage only mean something while the room is broadcasting.
     *
     * @throws LogicException
     */
    private function ensureLive(Room $room): void
    {
        if ($room->status !== RoomStatus::Live) {
            throw new LogicException('This only works while the room is live.');
        }
    }

    /**
     * Grant or take away a participant's camera and mic.
     *
     * @throws LogicException when promoting someone who is no longer connected, or LiveKit cannot be reached
     */
    private function applyPermissions(Room $room, RoomParticipant $participant, bool $speaker): void
    {
        $connected = $this->callLiveKit(fn () => $this->liveKit->updateParticipantPermissions(
            $room->livekit_room_name,
            $participant->uuid,
            canPublish: $speaker,
            canPublishSources: $speaker ? RoomJoinService::SPEAKER_SOURCES : [],
        ));

        if ($speaker && ! $connected) {
            throw new LogicException("{$participant->name} is no longer in the room.");
        }
    }

    /**
     * Run a LiveKit call, turning a transport failure into an error the host can act on.
     *
     * @template T
     *
     * @param  callable(): T  $call
     * @return T
     *
     * @throws LogicException
     */
    private function callLiveKit(callable $call): mixed
    {
        try {
            return $call();
        } catch (Throwable $e) {
            report($e);

            throw new LogicException('The media server could not be reached. Try again.', previous: $e);
        }
    }

    /**
     * Tell the host's studio. Losing the push only delays the queue until its next refresh.
     */
    private function announce(RoomParticipant $participant, RoomEventType $type): void
    {
        rescue(fn () => broadcast(new StageChanged($participant, $type)));
    }

    /**
     * Send a participant a message on their own LiveKit connection.
     */
    private function tell(RoomParticipant $participant, string $type): void
    {
        rescue(fn () => $this->liveKit->sendData(
            $participant->room->livekit_room_name,
            (string) json_encode(['type' => $type]),
            [$participant->uuid],
            self::TOPIC,
        ));
    }
}
