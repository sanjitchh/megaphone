<?php

namespace App\Http\Resources;

use App\Enums\RoomLinkStatus;
use App\Models\RoomLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Expects the `room` relation to be loaded: the actions depend on its status.
 *
 * @mixin RoomLink
 */
class RoomLinkResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->status();
        $roomAcceptsJoins = $this->room->status->acceptsJoins();

        return [
            'uuid' => $this->uuid,
            'label' => $this->label,
            'url' => route('join.show', $this->slug),
            'status' => $status->value,
            'expires_at' => $this->expires_at->toIso8601String(),
            'revoked_at' => $this->revoked_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'can' => [
                'change_expiry' => $status !== RoomLinkStatus::Revoked && $roomAcceptsJoins,
                'revoke' => $status !== RoomLinkStatus::Revoked,
                'regenerate' => $status === RoomLinkStatus::Active && $roomAcceptsJoins,
            ],
        ];
    }
}
