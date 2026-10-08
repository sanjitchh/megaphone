<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Database\Seeders\HostSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class HostAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_is_closed(): void
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertNotFound();

        $this->assertDatabaseCount('users', 0);
    }

    public function test_the_seeder_creates_a_verified_host_from_config(): void
    {
        config([
            'megaphone.host.name' => 'Ada',
            'megaphone.host.email' => 'ada@example.com',
            'megaphone.host.password' => 'secret-password',
        ]);

        $this->seed(HostSeeder::class);

        $host = User::query()->sole();
        $this->assertSame('Ada', $host->name);
        $this->assertSame('ada@example.com', $host->email);
        $this->assertNotNull($host->email_verified_at);
        $this->assertTrue(Hash::check('secret-password', $host->password));
    }

    public function test_the_seeder_is_idempotent(): void
    {
        $this->seed(HostSeeder::class);
        $this->seed(HostSeeder::class);

        $this->assertDatabaseCount('users', 1);
    }
}
