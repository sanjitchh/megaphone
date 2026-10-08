<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_home_page_sends_guests_to_the_login_page(): void
    {
        $this->followingRedirects()->get(route('home'))->assertOk();

        $this->get(route('rooms.index'))->assertRedirect(route('login'));
    }

    public function test_the_home_page_sends_the_host_to_their_rooms(): void
    {
        $this->actingAs(User::factory()->create())
            ->get(route('home'))
            ->assertRedirect(route('rooms.index'));
    }
}
