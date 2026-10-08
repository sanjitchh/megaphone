<?php

namespace App\Enums;

enum RoomStatus: string
{
    case Scheduled = 'SCHEDULED';
    case Live = 'LIVE';
    case Ended = 'ENDED';
    case Cancelled = 'CANCELLED';

    /**
     * Whether the room's schedule and capacity may still be changed.
     */
    public function isSchedulingEditable(): bool
    {
        return $this === self::Scheduled;
    }

    /**
     * Whether the room may be deleted. A live room has to be ended first.
     */
    public function isDeletable(): bool
    {
        return $this !== self::Live;
    }

    /**
     * Whether people can still join, so links may be created or opened.
     */
    public function acceptsJoins(): bool
    {
        return $this === self::Scheduled || $this === self::Live;
    }
}
