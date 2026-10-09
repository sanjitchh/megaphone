<?php

return [

    /*
    |--------------------------------------------------------------------------
    | LiveKit
    |--------------------------------------------------------------------------
    |
    | `url` is how the app reaches LiveKit's API (inside Docker, the livekit
    | container); `public_url` is the wss:// address browsers connect to.
    | Tokens live `token_ttl` seconds; LiveKit refreshes them for connected
    | clients, so this only bounds how long a token may sit unused.
    |
    */

    'url' => env('LIVEKIT_URL'),
    'public_url' => env('LIVEKIT_PUBLIC_URL'),
    'api_key' => env('LIVEKIT_API_KEY'),
    'api_secret' => env('LIVEKIT_API_SECRET'),
    'token_ttl' => env('LIVEKIT_TOKEN_TTL', 3600),
    'room_empty_timeout' => env('LIVEKIT_ROOM_EMPTY_TIMEOUT', 300),

    /*
     * Seconds a server-side LiveKit call may spend connecting, and in total. A hung LiveKit
     * otherwise pins the worker until the OS gives up on the TCP connect.
     */
    'connect_timeout' => env('LIVEKIT_CONNECT_TIMEOUT', 2),
    'request_timeout' => env('LIVEKIT_REQUEST_TIMEOUT', 3),

];
