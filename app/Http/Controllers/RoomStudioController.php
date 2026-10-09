<?php

namespace App\Http\Controllers;

use App\Http\Resources\RoomResource;
use App\Models\Room;
use App\Services\Rooms\RoomSessionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;

class RoomStudioController extends Controller
{
    /**
     * Show the host's studio: camera and mic preview, screen share, going live and ending.
     */
    public function show(Request $request, Room $room, RoomSessionService $sessions): Response|RedirectResponse
    {
        $this->ensureHost($request, $room);

        if (! $room->status->hasStudio()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This room has finished.')]);

            return to_route('rooms.edit', $room);
        }

        $room->load('host');

        return Inertia::render('rooms/studio', [
            'room' => RoomResource::make($room)->resolve(),
            // A LiveKit outage should not take the page down: the studio shows it and offers a retry.
            'connection' => fn () => rescue(fn () => $sessions->hostConnection($room)),
        ]);
    }

    /**
     * Start broadcasting.
     */
    public function goLive(Request $request, Room $room, RoomSessionService $sessions): RedirectResponse
    {
        $this->ensureHost($request, $room);

        try {
            $sessions->goLive($room);
        } catch (LogicException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __($e->getMessage())]);

            return to_route('rooms.studio', $room);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('You are live.')]);

        return to_route('rooms.studio', $room);
    }

    /**
     * End the session for everyone.
     */
    public function end(Request $request, Room $room, RoomSessionService $sessions): RedirectResponse
    {
        $this->ensureHost($request, $room);

        try {
            $sessions->end($room);
        } catch (LogicException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __($e->getMessage())]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Session ended.')]);

        return to_route('rooms.edit', $room);
    }

    /**
     * Only the room's host broadcasts from its studio: the LiveKit identity is theirs.
     */
    private function ensureHost(Request $request, Room $room): void
    {
        abort_unless($room->host_id === $request->user()?->getKey(), 403);
    }
}
