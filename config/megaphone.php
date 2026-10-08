<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Host account
    |--------------------------------------------------------------------------
    |
    | Megaphone runs with a single host for now (no admin team, no
    | invitations). The seeder creates this account; registration is off.
    |
    */

    'host' => [
        'name' => env('HOST_NAME', 'Host'),
        'email' => env('HOST_EMAIL', 'host@megaphone.local'),
        'password' => env('HOST_PASSWORD', 'password'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Rooms
    |--------------------------------------------------------------------------
    |
    | Stage limit: how many students can be promoted to speaker at once. It
    | bounds the subscriber fan-out (every viewer subscribes to every speaker),
    | so the per-room value is capped at `max_speakers_limit`.
    |
    */

    'rooms' => [
        'default_max_speakers' => (int) env('ROOMS_DEFAULT_MAX_SPEAKERS', 4),
        'max_speakers_limit' => (int) env('ROOMS_MAX_SPEAKERS_LIMIT', 8),
    ],

];
