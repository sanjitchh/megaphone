<?php

namespace App\Libraries\LiveKit;

use Agence104\LiveKit\AccessToken;
use Agence104\LiveKit\AccessTokenOptions;
use Agence104\LiveKit\RoomCreateOptions;
use Agence104\LiveKit\VideoGrant;
use GuzzleHttp\Client as HttpClient;
use InvalidArgumentException;

/**
 * Ported from Sentinel's `app/Services/LiveKit/LiveKitClient.php`, without its agent dispatch.
 */
class LiveKitClient
{
    private string $url;

    private ?string $publicUrl;

    private string $apiKey;

    private string $apiSecret;

    private int $tokenTtl;

    private int $roomEmptyTimeout;

    private int $connectTimeout;

    private int $requestTimeout;

    /**
     * Read and validate the LiveKit settings from `config/livekit.php`.
     */
    public function __construct()
    {
        $this->url = $this->requiredString('url');
        $this->publicUrl = $this->optionalString('public_url');
        $this->apiKey = $this->requiredString('api_key');
        $this->apiSecret = $this->requiredString('api_secret');
        $this->tokenTtl = $this->requiredPositiveInt('token_ttl');
        $this->roomEmptyTimeout = $this->requiredPositiveInt('room_empty_timeout');
        $this->connectTimeout = $this->requiredPositiveInt('connect_timeout');
        $this->requestTimeout = $this->requiredPositiveInt('request_timeout');
    }

    /**
     * Create a LiveKit room with optional participant and empty-timeout limits.
     *
     * Creating a room LiveKit already holds is a no-op that returns the existing room,
     * so this is safe to call before every join.
     *
     * @param  string|null  $metadata  Readable by every participant — never put secrets in it.
     */
    public function createRoom(string $roomName, ?int $maxParticipants = null, ?int $emptyTimeout = null, ?string $metadata = null): void
    {
        $options = (new RoomCreateOptions)
            ->setName($roomName)
            ->setEmptyTimeout($this->positiveIntOrDefault($emptyTimeout, $this->roomEmptyTimeout, 'emptyTimeout'));

        if ($maxParticipants !== null) {
            if ($maxParticipants < 1) {
                throw new InvalidArgumentException('maxParticipants must be a positive integer when provided.');
            }

            $options->setMaxParticipants($maxParticipants);
        }

        if ($metadata !== null) {
            $options->setMetadata($metadata);
        }

        $this->roomServiceClient()->createRoom($options);
    }

    /**
     * Close a LiveKit room, disconnecting everyone in it.
     */
    public function deleteRoom(string $roomName): void
    {
        $this->roomServiceClient()->deleteRoom($roomName);
    }

    /**
     * Generate a signed access token granting a participant join access to a room.
     *
     * @param  array<int, string>  $canPublishSources  Empty grants every source, per LiveKit.
     */
    public function generateToken(
        string $roomName,
        string $participantIdentity,
        string $participantName,
        bool $canPublish = true,
        bool $canSubscribe = true,
        bool $canPublishData = true,
        array $canPublishSources = [],
        bool $roomAdmin = false,
        ?int $ttl = null,
        ?string $metadata = null,
    ): string {
        $tokenOptions = (new AccessTokenOptions)
            ->setIdentity($participantIdentity)
            ->setName($participantName)
            ->setTtl($this->positiveIntOrDefault($ttl, $this->tokenTtl, 'ttl'));

        if ($metadata !== null) {
            $tokenOptions->setMetadata($metadata);
        }

        $videoGrant = (new VideoGrant)
            ->setRoomJoin()
            ->setRoomName($roomName)
            ->setCanPublish($canPublish)
            ->setCanSubscribe($canSubscribe)
            ->setCanPublishData($canPublishData);

        if ($canPublishSources !== []) {
            $videoGrant->setCanPublishSources($canPublishSources);
        }

        if ($roomAdmin) {
            $videoGrant->setRoomAdmin();
        }

        return (new AccessToken($this->apiKey, $this->apiSecret, $tokenOptions))
            ->setGrant($videoGrant)
            ->toJwt();
    }

    /**
     * The wss:// address browsers connect to.
     */
    public function publicUrl(): string
    {
        return $this->publicUrl ?? $this->url;
    }

    /**
     * A room service client bounded by the configured timeouts.
     */
    private function roomServiceClient(): TimeboxedRoomServiceClient
    {
        return new TimeboxedRoomServiceClient($this->roomServiceUrl(), $this->apiKey, $this->apiSecret, new HttpClient([
            'connect_timeout' => $this->connectTimeout,
            'timeout' => $this->requestTimeout,
        ]));
    }

    /**
     * The API speaks HTTP, so a ws(s):// URL is rewritten to its http(s):// twin.
     */
    private function roomServiceUrl(): string
    {
        if (preg_match('/^wss:\/\//i', $this->url) === 1) {
            return 'https://'.substr($this->url, 6);
        }

        if (preg_match('/^ws:\/\//i', $this->url) === 1) {
            return 'http://'.substr($this->url, 5);
        }

        return $this->url;
    }

    /**
     * Read a config value that must be a non-empty string.
     */
    private function requiredString(string $key): string
    {
        $value = config("livekit.{$key}");

        if (! is_string($value) || trim($value) === '') {
            throw new InvalidArgumentException("livekit.{$key} must be a non-empty string.");
        }

        return trim($value);
    }

    /**
     * Read a config value that may be absent, but must be a string when present.
     */
    private function optionalString(string $key): ?string
    {
        $value = config("livekit.{$key}");

        if ($value === null) {
            return null;
        }

        if (! is_string($value)) {
            throw new InvalidArgumentException("livekit.{$key} must be a string when provided.");
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }

    /**
     * Read a config value that must be a positive integer.
     */
    private function requiredPositiveInt(string $key): int
    {
        $parsed = filter_var(config("livekit.{$key}"), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);

        if ($parsed === false) {
            throw new InvalidArgumentException("livekit.{$key} must be a positive integer.");
        }

        return (int) $parsed;
    }

    /**
     * Use the given value, or the default when none was given; either must be positive.
     */
    private function positiveIntOrDefault(?int $value, int $default, string $name): int
    {
        $resolved = $value ?? $default;

        if ($resolved < 1) {
            throw new InvalidArgumentException("{$name} must be a positive integer.");
        }

        return $resolved;
    }
}
