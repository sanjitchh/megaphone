<?php

namespace App\Enums;

/**
 * Derived from a link's revoked_at and expires_at; not stored.
 */
enum RoomLinkStatus: string
{
    case Active = 'ACTIVE';
    case Expired = 'EXPIRED';
    case Revoked = 'REVOKED';
}
