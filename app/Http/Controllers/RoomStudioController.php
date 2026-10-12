<?php

namespace App\Http\Controllers;

use App\Http\Resources\RoomLinkResource;
use App\Http\Resources\RoomParticipantResource;
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
    public function show(Request $request, Room $room, RoomSessionService $sessions): Response
    {
        $this->ensureHost($request, $room);

        $room->load('host');

        // The studio runs in its own tab, so a finished room still renders here (as "session
        // over") rather than sending the host back to the dashboard mid-screen-share.
        if (! $room->status->hasStudio()) {
            return Inertia::render('rooms/studio', [
                'room' => RoomResource::make($room)->resolve(),
                'connection' => null,
                'links' => [],
                'stage' => ['hands' => [], 'speakers' => []],
            ]);
        }

        $links = $room->links()->forListing()->get()
            ->filter->isActive()
            ->each->setRelation('room', $room)
            ->values();

        return Inertia::render('rooms/studio', [
            'room' => RoomResource::make($room)->resolve(),
            // A LiveKit outage should not take the page down: the studio shows it and offers a retry.
            'connection' => fn () => rescue(fn () => $sessions->hostConnection($room)),
            'links' => RoomLinkResource::collection($links)->resolve(),
            // Small by design (hands and speakers, not the audience), so it is reloaded whole
            // whenever the studio hears that the stage changed.
            'stage' => fn () => [
                'hands' => RoomParticipantResource::collection($room->participants()->notRemoved()->handRaised()->get())->resolve(),
                'speakers' => RoomParticipantResource::collection($room->participants()->notRemoved()->speakers()->get())->resolve(),
            ],
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

        return to_route('rooms.studio', $room);
    }

    /**
     * Only the room's host broadcasts from its studio: the LiveKit identity is theirs.
     */
    private function ensureHost(Request $request, Room $room): void
    {
        abort_unless($room->host_id === $request->user()?->getKey(), 403);
    }
}
