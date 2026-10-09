<?php

namespace App\Libraries\LiveKit;

use Agence104\LiveKit\RoomServiceClient;
use Livekit\RoomServiceClient as TwirpRoomServiceClient;
use Psr\Http\Client\ClientInterface;

/**
 * The SDK's room service client, rebuilt on an HTTP client the caller controls.
 *
 * The SDK discovers its own PSR-18 client, which carries no timeouts at all.
 */
final class TimeboxedRoomServiceClient extends RoomServiceClient
{
    /**
     * Create a room service client that talks to LiveKit over the given HTTP client.
     */
    public function __construct(string $host, string $apiKey, string $apiSecret, ClientInterface $httpClient)
    {
        parent::__construct($host, $apiKey, $apiSecret);

        $this->rpc = new TwirpRoomServiceClient($host, $httpClient);
    }
}
