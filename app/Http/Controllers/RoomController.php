<?php

namespace App\Http\Controllers;

use App\Enums\RoomCapacity;
use App\Http\Requests\Rooms\StoreRoomRequest;
use App\Http\Requests\Rooms\UpdateRoomRequest;
use App\Http\Resources\RoomResource;
use App\Models\Room;
use App\Services\Rooms\RoomService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;

class RoomController extends Controller
{
    /**
     * List rooms: upcoming and live first, then finished ones.
     */
    public function index(): Response
    {
        $rooms = Room::query()->with('host')->forListing()->paginate(20);

        return Inertia::render('rooms/index', [
            'rooms' => RoomResource::collection($rooms),
        ]);
    }

    /**
     * Show the room creation form.
     */
    public function create(): Response
    {
        return Inertia::render('rooms/create', [
            'options' => $this->formOptions(),
        ]);
    }

    /**
     * Create a scheduled room hosted by the current user.
     */
    public function store(StoreRoomRequest $request, RoomService $rooms): RedirectResponse
    {
        $room = $rooms->create($request->user(), $request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Room created.')]);

        return to_route('rooms.edit', $room);
    }

    /**
     * Show the room edit form.
     */
    public function edit(Room $room): Response
    {
        $room->load('host');

        return Inertia::render('rooms/edit', [
            'room' => RoomResource::make($room)->resolve(),
            'options' => $this->formOptions(),
        ]);
    }

    /**
     * Update a room's details.
     */
    public function update(UpdateRoomRequest $request, Room $room, RoomService $rooms): RedirectResponse
    {
        $rooms->update($room, $request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Room updated.')]);

        return to_route('rooms.edit', $room);
    }

    /**
     * Soft-delete a room.
     */
    public function destroy(Room $room, RoomService $rooms): RedirectResponse
    {
        try {
            $rooms->delete($room);
        } catch (LogicException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __($e->getMessage())]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Room deleted.')]);

        return to_route('rooms.index');
    }

    /**
     * Choices and limits the create/edit form needs.
     *
     * @return array{capacities: list<int>, default_max_speakers: int, max_speakers_limit: int}
     */
    private function formOptions(): array
    {
        return [
            'capacities' => array_map(fn (RoomCapacity $capacity) => $capacity->value, RoomCapacity::cases()),
            'default_max_speakers' => (int) config('megaphone.rooms.default_max_speakers'),
            'max_speakers_limit' => (int) config('megaphone.rooms.max_speakers_limit'),
        ];
    }
}
