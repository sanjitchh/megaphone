<?php

namespace App\Enums;

/**
 * Why someone cannot get into a room. Each reason has its own screen on the join pages.
 */
enum JoinRefusal: string
{
    case Expired = 'expired';
    case Ended = 'ended';
    case Cancelled = 'cancelled';
    case Removed = 'removed';
    case Full = 'full';
}
