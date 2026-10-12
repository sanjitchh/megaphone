<?php

namespace App\Events;

use App\Enums\RoomEventType;
use App\Models\RoomParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Tells the host's studio that a hand or the stage changed, so it refreshes its queue.
 */
class StageChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    /**
     * Create the event for what happened to whom.
     */
    public function __construct(public RoomParticipant $participant, public RoomEventType $type) {}

    /**
     * The host's private studio channel.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('rooms.'.$this->participant->room->uuid.'.studio')];
    }

    /**
     * The name the studio listens for.
     */
    public function broadcastAs(): string
    {
        return 'stage.changed';
    }

    /**
     * Enough to toast "Ada raised their hand" without another request.
     *
     * @return array{type: string, participant: array{uuid: string, name: string}}
     */
    public function broadcastWith(): array
    {
        return [
            'type' => $this->type->value,
            'participant' => ['uuid' => $this->participant->uuid, 'name' => $this->participant->name],
        ];
    }
}
