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

    /*
    |--------------------------------------------------------------------------
    | Room links
    |--------------------------------------------------------------------------
    |
    | Join links (/r/{slug}) are the only access control, so the slug has to
    | be unguessable: each character carries 5 bits. `join_rate_limit` caps
    | how often one IP may open join links per minute.
    |
    */

    'links' => [
        'slug_length' => 24, // room_links.slug is varchar(32)
        'join_rate_limit' => (int) env('ROOM_LINKS_JOIN_RATE_LIMIT', 30),
    ],

];
