<?php

namespace App\Http\Controllers;

use App\Enums\RoomStatus;
use App\Models\RoomLink;
use Inertia\Inertia;
use Inertia\Response;

class JoinController extends Controller
{
    /**
     * The public landing page behind a share link.
     *
     * A link to a deleted room, or a revoked or expired link, all read as
     * "expired" (SPEC §4.1): the page never says which, and issues no token.
     */
    public function show(RoomLink $link): Response
    {
        $room = $link->room;

        if ($room === null || ! $link->isActive()) {
            return Inertia::render('join/unavailable', ['reason' => 'expired']);
        }

        if (! $room->status->acceptsJoins()) {
            return Inertia::render('join/unavailable', [
                'reason' => $room->status === RoomStatus::Cancelled ? 'cancelled' : 'ended',
                'title' => $room->title,
            ]);
        }

        $room->load('host');

        return Inertia::render('join/show', [
            'room' => [
                'title' => $room->title,
                'description' => $room->description,
                'status' => $room->status->value,
                'starts_at' => $room->starts_at->toIso8601String(),
                'ends_at' => $room->ends_at->toIso8601String(),
                'host' => $room->host->name,
            ],
        ]);
    }
}
