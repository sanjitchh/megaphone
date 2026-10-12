<?php

namespace App\Http\Controllers;

use App\Enums\JoinRefusal;
use App\Enums\RoomStatus;
use App\Exceptions\JoinRefusedException;
use App\Http\Requests\Join\JoinRoomRequest;
use App\Models\Room;
use App\Models\RoomLink;
use App\Models\RoomParticipant;
use App\Services\Rooms\RoomJoinService;
use App\Services\Rooms\StageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;

class JoinController extends Controller
{
    /**
     * The public landing page behind a share link: the room and the pre-join form.
     *
     * A link to a deleted room, or a revoked or expired link, all read as
     * "expired" (SPEC §4.1): the page never says which, and issues no token.
     */
    public function show(Request $request, RoomLink $link): Response
    {
        $room = $link->room;

        if ($room === null || ! $link->isActive()) {
            return Inertia::render('join/unavailable', ['reason' => JoinRefusal::Expired->value]);
        }

        if (! $room->status->acceptsJoins()) {
            return Inertia::render('join/unavailable', [
                'reason' => $room->status === RoomStatus::Cancelled ? JoinRefusal::Cancelled->value : JoinRefusal::Ended->value,
                'title' => $room->title,
            ]);
        }

        $room->load('host');
        $returning = $this->participant($request, $room);

        return Inertia::render('join/show', [
            'slug' => $link->slug,
            'room' => $this->roomSummary($room),
            'returning' => $returning === null ? null : [
                'name' => $returning->name,
                'email' => $returning->guest->email,
            ],
        ]);
    }

    /**
     * Join with a name and email, then go into the room. The browser's session remembers
     * who joined, so a refresh goes straight back in.
     */
    public function store(JoinRoomRequest $request, RoomLink $link, RoomJoinService $joins): RedirectResponse
    {
        try {
            $participant = $joins->join($link, $request->validated('name'), $request->validated('email'));
        } catch (JoinRefusedException $e) {
            if ($e->reason === JoinRefusal::Removed) {
                return back()->withErrors(['email' => __('The host removed you from this webinar, so you cannot rejoin it.')]);
            }

            return to_route('join.show', $link);
        }

        $request->session()->put($this->sessionKey($participant->room), $participant->uuid);

        return to_route('join.room', $link);
    }

    /**
     * The room itself, as a viewer (or speaker). Refusals (full, removed, ended) are shown in
     * place, so a retry is a partial reload of `access`.
     */
    public function room(Request $request, RoomLink $link, RoomJoinService $joins): Response|RedirectResponse
    {
        $room = $link->room;
        $participant = $room === null ? null : $this->participant($request, $room);

        if ($room === null || $participant === null) {
            return to_route('join.show', $link);
        }

        $room->load('host');

        return Inertia::render('join/room', [
            'slug' => $link->slug,
            'room' => $this->roomSummary($room),
            'participant' => fn () => [
                'uuid' => $participant->uuid,
                'name' => $participant->name,
                'hand_raised' => $participant->refresh()->hand_raised_at !== null,
            ],
            'access' => function () use ($joins, $participant, $link) {
                try {
                    return ['connection' => $joins->connection($participant, $link), 'refusal' => null];
                } catch (JoinRefusedException $e) {
                    return ['connection' => null, 'refusal' => $e->reason->value];
                } catch (\Throwable $e) {
                    // LiveKit unreachable: the page offers a retry.
                    report($e);

                    return ['connection' => null, 'refusal' => null];
                }
            },
        ]);
    }

    /**
     * Raise or lower the participant's own hand.
     */
    public function hand(Request $request, RoomLink $link, StageService $stage): RedirectResponse
    {
        $validated = $request->validate(['raised' => ['required', 'boolean']]);
        $participant = $link->room === null ? null : $this->participant($request, $link->room);

        abort_if($participant === null, 403);

        try {
            $stage->setHand($participant, (bool) $validated['raised']);
        } catch (LogicException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __($e->getMessage())]);
        }

        return to_route('join.room', $link);
    }

    /**
     * Who this browser joined the room as, if anyone.
     */
    private function participant(Request $request, Room $room): ?RoomParticipant
    {
        $uuid = $request->session()->get($this->sessionKey($room));

        return $uuid === null ? null : $room->participants()->with('guest')->where('uuid', $uuid)->first();
    }

    /**
     * The session key holding the participant this browser joined a room as.
     */
    private function sessionKey(Room $room): string
    {
        return 'joined_rooms.'.$room->uuid;
    }

    /**
     * What a guest may know about the room.
     *
     * @return array<string, mixed>
     */
    private function roomSummary(Room $room): array
    {
        return [
            'title' => $room->title,
            'description' => $room->description,
            'status' => $room->status->value,
            'starts_at' => $room->starts_at->toIso8601String(),
            'ends_at' => $room->ends_at->toIso8601String(),
            'host' => $room->host->name,
        ];
    }
}
