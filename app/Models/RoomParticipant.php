<?php

namespace App\Models;

use Database\Factories\RoomParticipantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

/**
 * A guest's place in one room. Its UUID is their LiveKit identity there, and it carries
 * the room-level state: a raised hand, being on stage, being removed.
 *
 * @property int $id
 * @property string $uuid
 * @property int $room_id
 * @property int $guest_id
 * @property int|null $room_link_id
 * @property string $name
 * @property Carbon|null $hand_raised_at
 * @property Carbon|null $promoted_at
 * @property Carbon|null $removed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['room_id', 'guest_id', 'room_link_id', 'name', 'hand_raised_at', 'promoted_at', 'removed_at'])]
#[Hidden(['id', 'room_id', 'guest_id', 'room_link_id'])]
class RoomParticipant extends Model implements AuditableContract
{
    /** @use HasFactory<RoomParticipantFactory> */
    use Auditable, HasFactory, HasUuids, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'hand_raised_at' => 'datetime',
            'promoted_at' => 'datetime',
            'removed_at' => 'datetime',
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
     * Resolve route bindings by UUID, never by the sequential id.
     */
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * The room joined.
     *
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * Who joined.
     *
     * @return BelongsTo<Guest, $this>
     */
    public function guest(): BelongsTo
    {
        return $this->belongsTo(Guest::class);
    }

    /**
     * The share link they came in through.
     *
     * @return BelongsTo<RoomLink, $this>
     */
    public function link(): BelongsTo
    {
        return $this->belongsTo(RoomLink::class, 'room_link_id');
    }

    /**
     * Whether the host has removed them from the room.
     */
    public function isRemoved(): bool
    {
        return $this->removed_at !== null;
    }

    /**
     * Whether they are on stage, allowed to publish their camera and mic.
     */
    public function isSpeaker(): bool
    {
        return $this->promoted_at !== null;
    }

    /**
     * Participants still in the room's good books.
     *
     * @param  Builder<RoomParticipant>  $query
     */
    public function scopeNotRemoved(Builder $query): void
    {
        $query->whereNull('removed_at');
    }

    /**
     * Raised hands, longest waiting first (SPEC §4.3).
     *
     * @param  Builder<RoomParticipant>  $query
     */
    public function scopeHandRaised(Builder $query): void
    {
        $query->whereNotNull('hand_raised_at')->orderBy('hand_raised_at');
    }

    /**
     * Participants on stage, in the order they were brought up.
     *
     * @param  Builder<RoomParticipant>  $query
     */
    public function scopeSpeakers(Builder $query): void
    {
        $query->whereNotNull('promoted_at')->orderBy('promoted_at');
    }
}
