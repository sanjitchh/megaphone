<?php

namespace App\Models;

use App\Enums\RoomEventType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * An append-only log of what happened in a room (SPEC §10). The actor is the host
 * (`user_id`) or, with no user, the participant themselves.
 *
 * @property int $id
 * @property string $uuid
 * @property int $room_id
 * @property int|null $room_participant_id
 * @property int|null $user_id
 * @property RoomEventType $type
 * @property array<string, mixed>|null $payload
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['room_id', 'room_participant_id', 'user_id', 'type', 'payload'])]
#[Hidden(['id', 'room_id', 'room_participant_id', 'user_id'])]
class RoomEvent extends Model
{
    use HasUuids, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => RoomEventType::class,
            'payload' => 'array',
        ];
    }

    /**
     * The columns that receive a UUID on create; the bigint id stays the primary key.
     *
     * @return array<int, string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    /**
     * Log an event against a participant, by the host when one is given.
     *
     * @param  array<string, mixed>|null  $payload
     */
    public static function record(RoomParticipant $participant, RoomEventType $type, ?User $actor = null, ?array $payload = null): self
    {
        return self::query()->create([
            'room_id' => $participant->room_id,
            'room_participant_id' => $participant->getKey(),
            'user_id' => $actor?->getKey(),
            'type' => $type,
            'payload' => $payload,
        ]);
    }

    /**
     * The room it happened in.
     *
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * The participant it happened to.
     *
     * @return BelongsTo<RoomParticipant, $this>
     */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(RoomParticipant::class, 'room_participant_id');
    }
}
