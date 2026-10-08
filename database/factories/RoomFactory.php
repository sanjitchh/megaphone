<?php

namespace Database\Factories;

use App\Enums\RoomCapacity;
use App\Enums\RoomStatus;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Room>
 */
class RoomFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startsAt = now()->addDays(fake()->numberBetween(1, 30))->setTime(fake()->numberBetween(8, 18), 0);

        return [
            'host_id' => User::factory(),
            'created_by' => fn (array $attributes) => $attributes['host_id'],
            'title' => Str::title(fake()->words(3, true)),
            'description' => fake()->optional()->paragraph(),
            'max_participants' => RoomCapacity::Small->value,
            'max_speakers' => config('megaphone.rooms.default_max_speakers'),
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addHour(),
            'status' => RoomStatus::Scheduled,
            'settings' => null,
            'livekit_room_name' => 'room-'.Str::uuid7(),
        ];
    }

    /**
     * Indicate that the room is broadcasting.
     */
    public function live(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RoomStatus::Live,
        ]);
    }

    /**
     * Indicate that the room has finished.
     */
    public function ended(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RoomStatus::Ended,
        ]);
    }
}
