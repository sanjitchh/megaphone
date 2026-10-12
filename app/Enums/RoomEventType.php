<?php

namespace App\Enums;

enum RoomEventType: string
{
    case Joined = 'PARTICIPANT.JOINED';
    case Removed = 'PARTICIPANT.REMOVED';
    case HandRaised = 'HAND.RAISED';
    case HandLowered = 'HAND.LOWERED';
    case SpeakerPromoted = 'SPEAKER.PROMOTED';
    case SpeakerDemoted = 'SPEAKER.DEMOTED';
}
