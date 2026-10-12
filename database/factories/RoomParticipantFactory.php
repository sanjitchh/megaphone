<?php

namespace Database\Factories;

use App\Models\Guest;
use App\Models\Room;
use App\Models\RoomParticipant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomParticipant>
 */
class RoomParticipantFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'room_id' => Room::factory(),
            'guest_id' => Guest::factory(),
            'room_link_id' => null,
            'name' => fake()->name(),
            'hand_raised_at' => null,
            'promoted_at' => null,
            'removed_at' => null,
        ];
    }

    /**
     * Indicate that the participant has a hand up.
     */
    public function handRaised(): static
    {
        return $this->state(fn (array $attributes) => ['hand_raised_at' => now()]);
    }

    /**
     * Indicate that the participant is on stage.
     */
    public function speaker(): static
    {
        return $this->state(fn (array $attributes) => ['promoted_at' => now()]);
    }

    /**
     * Indicate that the host removed the participant.
     */
    public function removed(): static
    {
        return $this->state(fn (array $attributes) => ['removed_at' => now()]);
    }
}
