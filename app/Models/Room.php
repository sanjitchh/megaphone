<?php

namespace App\Models;

use App\Enums\RoomStatus;
use Database\Factories\RoomFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

/**
 * @property int $id
 * @property string $uuid
 * @property int $host_id
 * @property int $created_by
 * @property string $title
 * @property string|null $description
 * @property int $max_participants
 * @property int $max_speakers
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property Carbon|null $started_at
 * @property Carbon|null $ended_at
 * @property RoomStatus $status
 * @property array<string, mixed>|null $settings
 * @property string $livekit_room_name
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['host_id', 'created_by', 'title', 'description', 'max_participants', 'max_speakers', 'starts_at', 'ends_at', 'started_at', 'ended_at', 'status', 'settings', 'livekit_room_name'])]
#[Hidden(['id', 'host_id', 'created_by'])]
class Room extends Model implements AuditableContract
{
    /** @use HasFactory<RoomFactory> */
    use Auditable, HasFactory, HasUuids, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'max_participants' => 'integer',
            'max_speakers' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'status' => RoomStatus::class,
            'settings' => 'array',
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
     * The presenter whose camera and mic are the room's main feed.
     *
     * @return BelongsTo<User, $this>
     */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /**
     * The admin who created the room.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The share links people join through.
     *
     * @return HasMany<RoomLink, $this>
     */
    public function links(): HasMany
    {
        return $this->hasMany(RoomLink::class);
    }

    /**
     * Everyone who has joined through a share link.
     *
     * @return HasMany<RoomParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(RoomParticipant::class);
    }

    /**
     * Upcoming and live rooms first (soonest start on top), then finished ones (most recent on top).
     *
     * @param  Builder<Room>  $query
     */
    public function scopeForListing(Builder $query): void
    {
        $query
            ->orderByRaw('status in (?, ?) desc', [RoomStatus::Scheduled->value, RoomStatus::Live->value])
            ->orderByRaw('case when status in (?, ?) then starts_at end asc', [RoomStatus::Scheduled->value, RoomStatus::Live->value])
            ->orderByDesc('starts_at');
    }
}
