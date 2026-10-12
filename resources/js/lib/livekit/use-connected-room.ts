import { router } from '@inertiajs/react';
import { DisconnectReason, Room, RoomEvent, Track } from 'livekit-client';
import type { LocalTrack } from 'livekit-client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { connectRoomOnce, disconnectRoom } from '@/lib/livekit/connect-room';
import '@/lib/livekit/logging';
import { useRoomConnectionStatus } from '@/lib/livekit/use-room-connection';
import type { RoomConnectionStatus } from '@/lib/livekit/use-room-connection';

export type LiveKitConnection = {
    server_url: string;
    token: string;
};

/**
 * A LiveKit room for one page. Connects with the grant the page was given, stays connected
 * across Inertia visits back to the same page (a fresh grant handed down while connected is
 * ignored), and leaves on unmount. `reconnect` reloads the prop holding the grant and rejoins.
 *
 * Everyone auto-subscribes: only the host and promoted speakers ever publish, so subscribing
 * to everything published is already the bounded set SPEC §5 asks for.
 */
export function useConnectedRoom(
    connection: LiveKitConnection | null,
    grantProp: string,
): {
    room: Room;
    status: RoomConnectionStatus;
    disconnectReason: DisconnectReason | undefined;
    reconnect: () => void;
} {
    const [room] = useState(
        () =>
            new Room({
                adaptiveStream: true,
                dynacast: true,
                publishDefaults: { simulcast: true },
            }),
    );
    const [failed, setFailed] = useState(false);
    const [disconnectReason, setDisconnectReason] =
        useState<DisconnectReason>();
    const [attempt, setAttempt] = useState(0);

    const serverUrl = connection?.server_url;
    const token = connection?.token;

    useEffect(() => {
        const handleDisconnected = (reason?: DisconnectReason) =>
            setDisconnectReason(reason);

        room.on(RoomEvent.Disconnected, handleDisconnected);

        return () => {
            room.off(RoomEvent.Disconnected, handleDisconnected);
            void disconnectRoom(room);
        };
    }, [room]);

    useEffect(() => {
        if (!serverUrl || !token) {
            return;
        }

        let active = true;

        connectRoomOnce(room, serverUrl, token).catch(() => {
            if (active) {
                setFailed(true);
            }
        });

        return () => {
            active = false;
        };
    }, [room, serverUrl, token, attempt]);

    const reconnect = () => {
        setFailed(false);
        setDisconnectReason(undefined);
        router.reload({
            only: [grantProp],
            onSuccess: () => setAttempt((value) => value + 1),
        });
    };

    return {
        room,
        status: useRoomConnectionStatus(room, failed || connection === null),
        disconnectReason,
        reconnect,
    };
}

const sources = [Track.Source.Camera, Track.Source.Microphone] as const;

/**
 * Keeps the camera and mic publications in step with what should be on air: published while
 * `enabled` and connected (and again after a rejoin, which starts with nothing published),
 * replaced when a track is swapped, and unpublished when a track goes away or `enabled` ends.
 * The caller owns the tracks, so unpublishing never stops them.
 */
export function usePublishedTracks(
    room: Room,
    enabled: boolean,
    connected: boolean,
    camera: LocalTrack | undefined,
    microphone: LocalTrack | undefined,
): void {
    useEffect(() => {
        if (!connected) {
            return;
        }

        const wanted = { camera, microphone };

        for (const source of sources) {
            const track = enabled
                ? source === Track.Source.Camera
                    ? wanted.camera
                    : wanted.microphone
                : undefined;
            const published =
                room.localParticipant.getTrackPublication(source)?.track;

            if (published === track) {
                continue;
            }

            void (async () => {
                if (published) {
                    await room.localParticipant.unpublishTrack(
                        published,
                        false,
                    );
                }

                if (track) {
                    await room.localParticipant.publishTrack(track);
                }
            })().catch(() => {
                if (track) {
                    toast.error(
                        source === Track.Source.Camera
                            ? 'Your camera could not be broadcast.'
                            : 'Your microphone could not be broadcast.',
                    );
                }
            });
        }
    }, [room, enabled, connected, camera, microphone]);
}
