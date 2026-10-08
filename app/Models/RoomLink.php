<?php

namespace App\Models;

use App\Enums\RoomLinkStatus;
use Database\Factories\RoomLinkFactory;
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
 * @property int $id
 * @property string $uuid
 * @property int $room_id
 * @property int $created_by
 * @property string $slug
 * @property string|null $label
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['room_id', 'created_by', 'slug', 'label', 'expires_at', 'revoked_at'])]
#[Hidden(['id', 'room_id', 'created_by'])]
class RoomLink extends Model implements AuditableContract
{
    /** @use HasFactory<RoomLinkFactory> */
    use Auditable, HasFactory, HasUuids, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
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
     * Resolve dashboard route bindings by UUID. The public join route binds by slug explicitly.
     */
    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * The room this link joins.
     *
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * The admin who created the link.
     *
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * A new unguessable join slug: 24 characters from a 32-letter alphabet (120 bits).
     *
     * Lowercase only, because the MySQL collation compares slugs case-insensitively;
     * look-alike characters (0/o, 1/l) are left out so a slug can be read aloud.
     */
    public static function newSlug(): string
    {
        $alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
        $length = (int) config('megaphone.links.slug_length');

        $slug = '';
        for ($i = 0; $i < $length; $i++) {
            $slug .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $slug;
    }

    /**
     * Revoked wins over expired: a revoked link cannot be brought back by extending it.
     */
    public function status(): RoomLinkStatus
    {
        return match (true) {
            $this->revoked_at !== null => RoomLinkStatus::Revoked,
            $this->expires_at->isPast() => RoomLinkStatus::Expired,
            default => RoomLinkStatus::Active,
        };
    }

    /**
     * Whether the link still lets people in.
     */
    public function isActive(): bool
    {
        return $this->status() === RoomLinkStatus::Active;
    }

    /**
     * Active links first, then the rest; newest first within each group.
     *
     * @param  Builder<RoomLink>  $query
     */
    public function scopeForListing(Builder $query): void
    {
        $query
            ->orderByRaw('revoked_at is null and expires_at > ? desc', [now()])
            ->latest('id');
    }
}
