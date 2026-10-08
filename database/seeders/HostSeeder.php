<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class HostSeeder extends Seeder
{
    /**
     * Create (or refresh) the single host account from config/megaphone.php.
     *
     * Idempotent: keyed on the email, so re-running resets the name and password.
     */
    public function run(): void
    {
        $host = User::withTrashed()->firstOrNew(['email' => config('megaphone.host.email')]);

        $host->forceFill([
            'name' => config('megaphone.host.name'),
            'password' => config('megaphone.host.password'),
            'email_verified_at' => $host->email_verified_at ?? now(),
            'deleted_at' => null,
        ])->save();
    }
}
