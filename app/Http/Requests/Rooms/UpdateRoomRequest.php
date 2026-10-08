<?php

namespace App\Http\Requests\Rooms;

use App\Enums\RoomCapacity;
use App\Models\Room;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRoomRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * Schedule and capacity are only accepted while the room is scheduled; for
     * any other status they are rejected rather than silently dropped.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Room $room */
        $room = $this->route('room');

        $scheduling = $room->status->isSchedulingEditable()
            ? [
                'max_participants' => ['required', 'integer', Rule::enum(RoomCapacity::class)],
                'max_speakers' => ['required', 'integer', 'min:0', 'max:'.config('megaphone.rooms.max_speakers_limit')],
                'starts_at' => ['required', 'date'],
                'ends_at' => ['required', 'date', 'after:starts_at', 'after:now'],
            ]
            : [
                'max_participants' => ['prohibited'],
                'max_speakers' => ['prohibited'],
                'starts_at' => ['prohibited'],
                'ends_at' => ['prohibited'],
            ];

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            ...$scheduling,
        ];
    }

    /**
     * Get custom attribute names for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'max_participants' => 'capacity',
            'max_speakers' => 'stage limit',
            'starts_at' => 'start time',
            'ends_at' => 'end time',
        ];
    }
}
