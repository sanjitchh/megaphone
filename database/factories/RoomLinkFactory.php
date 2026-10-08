<?php

namespace Database\Factories;

use App\Models\Room;
use App\Models\RoomLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RoomLink>
 */
class RoomLinkFactory extends Factory
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
            'created_by' => fn (array $attributes) => Room::query()->find($attributes['room_id'])?->host_id,
            'slug' => RoomLink::newSlug(),
            'label' => null,
            'expires_at' => now()->addDay(),
            'revoked_at' => null,
        ];
    }

    /**
     * Indicate that the link's expiry has passed.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => now()->subMinute(),
        ]);
    }

    /**
     * Indicate that the link was revoked.
     */
    public function revoked(): static
    {
        return $this->state(fn (array $attributes) => [
            'revoked_at' => now()->subMinute(),
        ]);
    }
}
