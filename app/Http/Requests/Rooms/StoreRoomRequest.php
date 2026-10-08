<?php

namespace App\Http\Requests\Rooms;

use App\Enums\RoomCapacity;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoomRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'max_participants' => ['required', 'integer', Rule::enum(RoomCapacity::class)],
            'max_speakers' => ['required', 'integer', 'min:0', 'max:'.config('megaphone.rooms.max_speakers_limit')],
            'starts_at' => ['required', 'date', 'after:now'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
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
