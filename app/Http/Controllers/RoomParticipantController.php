<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Services\Rooms\StageService;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use LogicException;

/**
 * The host's moderation actions from the studio (SPEC §4.3).
 */
class RoomParticipantController extends Controller
{
    /**
     * Bring a participant on stage.
     */
    public function promote(Request $request, Room $room, RoomParticipant $participant, StageService $stage): RedirectResponse
    {
        return $this->attempt($request, $room, fn () => $stage->promote($participant, $request->user()), __(':name is on stage.', ['name' => $participant->name]));
    }

    /**
     * Take a participant off stage.
     */
    public function demote(Request $request, Room $room, RoomParticipant $participant, StageService $stage): RedirectResponse
    {
        return $this->attempt($request, $room, fn () => $stage->demote($participant, $request->user()), __(':name is back in the audience.', ['name' => $participant->name]));
    }

    /**
     * Lower a participant's hand.
     */
    public function lowerHand(Request $request, Room $room, RoomParticipant $participant, StageService $stage): RedirectResponse
    {
        return $this->attempt($request, $room, fn () => $stage->setHand($participant, false, $request->user()), null);
    }

    /**
     * Remove a participant from the room for good.
     */
    public function remove(Request $request, Room $room, RoomParticipant $participant, StageService $stage): RedirectResponse
    {
        return $this->attempt($request, $room, fn () => $stage->remove($participant, $request->user()), __(':name was removed.', ['name' => $participant->name]));
    }

    /**
     * Run a moderation action as the room's host and go back to the studio, toasting the outcome.
     */
    private function attempt(Request $request, Room $room, Closure $action, ?string $success): RedirectResponse
    {
        abort_unless($room->host_id === $request->user()?->getKey(), 403);

        try {
            $action();
        } catch (LogicException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __($e->getMessage())]);

            return to_route('rooms.studio', $room);
        }

        if ($success !== null) {
            Inertia::flash('toast', ['type' => 'success', 'message' => $success]);
        }

        return to_route('rooms.studio', $room);
    }
}
