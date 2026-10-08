<?php

namespace App\Http\Controllers;

use App\Http\Requests\RoomLinks\StoreRoomLinkRequest;
use App\Http\Requests\RoomLinks\UpdateRoomLinkRequest;
use App\Models\Room;
use App\Models\RoomLink;
use App\Services\Rooms\RoomLinkService;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use LogicException;

class RoomLinkController extends Controller
{
    /**
     * Create a share link for the room.
     */
    public function store(StoreRoomLinkRequest $request, Room $room, RoomLinkService $links): RedirectResponse
    {
        return $this->attempt(
            fn () => $links->create($room, $request->user(), $request->validated()),
            __('Link created.'),
        );
    }

    /**
     * Move a link's expiry.
     */
    public function update(UpdateRoomLinkRequest $request, Room $room, RoomLink $link, RoomLinkService $links): RedirectResponse
    {
        return $this->attempt(
            fn () => $links->changeExpiry($link, $request->validated('expires_at')),
            __('Link expiry updated.'),
        );
    }

    /**
     * Revoke a link so it stops letting people in.
     */
    public function revoke(Room $room, RoomLink $link, RoomLinkService $links): RedirectResponse
    {
        return $this->attempt(
            fn () => $links->revoke($link),
            __('Link revoked.'),
        );
    }

    /**
     * Replace a link with a fresh slug, revoking the old one.
     */
    public function regenerate(Request $request, Room $room, RoomLink $link, RoomLinkService $links): RedirectResponse
    {
        return $this->attempt(
            fn () => $links->regenerate($link, $request->user()),
            __('Link regenerated. The old link no longer works.'),
        );
    }

    /**
     * Run a link change and go back to the room, toasting the outcome.
     */
    private function attempt(Closure $change, string $success): RedirectResponse
    {
        try {
            $change();
        } catch (LogicException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __($e->getMessage())]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $success]);

        return back();
    }
}
