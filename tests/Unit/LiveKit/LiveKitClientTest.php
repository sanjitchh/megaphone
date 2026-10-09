<?php

namespace Tests\Unit\LiveKit;

use App\Libraries\LiveKit\LiveKitClient;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use InvalidArgumentException;
use Tests\TestCase;

class LiveKitClientTest extends TestCase
{
    /**
     * Known LiveKit settings, independent of the environment.
     */
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('livekit', [
            'url' => 'http://livekit:7880',
            'public_url' => 'wss://megaphone.test',
            'api_key' => 'test-key',
            'api_secret' => 'test-secret-that-is-at-least-32-chars',
            'token_ttl' => 3600,
            'room_empty_timeout' => 300,
            'connect_timeout' => 2,
            'request_timeout' => 3,
        ]);
    }

    public function test_a_token_carries_the_requested_grants(): void
    {
        $jwt = (new LiveKitClient)->generateToken(
            roomName: 'room-abc',
            participantIdentity: 'host-uuid',
            participantName: 'Ada',
            canPublishSources: ['camera', 'screen_share'],
            roomAdmin: true,
            metadata: '{"role":"host"}',
        );

        $claims = JWT::decode($jwt, new Key('test-secret-that-is-at-least-32-chars', 'HS256'));

        $this->assertSame('test-key', $claims->iss);
        $this->assertSame('host-uuid', $claims->sub);
        $this->assertSame('Ada', $claims->name);
        $this->assertSame('{"role":"host"}', $claims->metadata);
        $this->assertSame('room-abc', $claims->video->room);
        $this->assertTrue($claims->video->roomJoin);
        $this->assertTrue($claims->video->roomAdmin);
        $this->assertTrue($claims->video->canPublish);
        $this->assertSame(['camera', 'screen_share'], $claims->video->canPublishSources);
    }

    public function test_room_admin_is_not_granted_by_default(): void
    {
        $jwt = (new LiveKitClient)->generateToken('room-abc', 'viewer-uuid', 'Viewer', canPublish: false);

        $claims = JWT::decode($jwt, new Key('test-secret-that-is-at-least-32-chars', 'HS256'));

        $this->assertFalse($claims->video->canPublish);
        $this->assertObjectNotHasProperty('roomAdmin', $claims->video);
    }

    public function test_browsers_get_the_public_url(): void
    {
        $this->assertSame('wss://megaphone.test', (new LiveKitClient)->publicUrl());
    }

    public function test_missing_settings_are_refused(): void
    {
        config()->set('livekit.api_secret', '');

        $this->expectException(InvalidArgumentException::class);

        new LiveKitClient;
    }
}
