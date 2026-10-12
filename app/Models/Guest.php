<?php

namespace App\Models;

use Database\Factories\GuestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use OwenIt\Auditing\Auditable;
use OwenIt\Auditing\Contracts\Auditable as AuditableContract;

/**
 * Someone who joined through a share link: no account, just a name and an email.
 * A returning email reuses the same guest (SPEC §4.2).
 *
 * @property int $id
 * @property string $uuid
 * @property string $name
 * @property string $email
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Fillable(['name', 'email'])]
#[Hidden(['id'])]
class Guest extends Model implements AuditableContract
{
    /** @use HasFactory<GuestFactory> */
    use Auditable, HasFactory, HasUuids, SoftDeletes;

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
     * The rooms this guest has joined.
     *
     * @return HasMany<RoomParticipant, $this>
     */
    public function participations(): HasMany
    {
        return $this->hasMany(RoomParticipant::class);
    }
}
