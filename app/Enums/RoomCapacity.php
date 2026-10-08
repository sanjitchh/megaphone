<?php

namespace App\Enums;

/**
 * The audience sizes a room can be created with (SPEC §4.1).
 */
enum RoomCapacity: int
{
    case Small = 200;
    case Large = 500;
}
