<?php

namespace App\Http\Resources;

use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Room
 */
class RoomResource extends JsonResource
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
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status->value,
            'max_participants' => $this->max_participants,
            'max_speakers' => $this->max_speakers,
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'host' => $this->whenLoaded('host', fn () => [
                'uuid' => $this->host->uuid,
                'name' => $this->host->name,
            ]),
            'can' => [
                'edit_schedule' => $this->status->isSchedulingEditable(),
                'delete' => $this->status->isDeletable(),
            ],
        ];
    }
}
