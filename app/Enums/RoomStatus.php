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

    /**
     * Whether the host can open the studio: before and during the broadcast.
     */
    public function hasStudio(): bool
    {
        return $this->acceptsJoins();
    }

    /**
     * Whether the host may start broadcasting.
     */
    public function canGoLive(): bool
    {
        return $this === self::Scheduled;
    }

    /**
     * Whether the session may be ended for everyone.
     */
    public function canEnd(): bool
    {
        return $this === self::Live;
    }
}
