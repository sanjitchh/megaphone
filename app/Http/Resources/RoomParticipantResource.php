<?php

namespace App\Http\Resources;

use App\Models\RoomParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin RoomParticipant
 */
class RoomParticipantResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'name' => $this->name,
            'hand_raised_at' => $this->hand_raised_at?->toIso8601String(),
            'promoted_at' => $this->promoted_at?->toIso8601String(),
        ];
    }
}
