import { router } from '@inertiajs/react';
import { DisconnectReason, Room, RoomEvent, Track } from 'livekit-client';
import type { LocalTrack, LocalVideoTrack } from 'livekit-client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { connectRoomOnce, disconnectRoom } from '@/lib/livekit/connect-room';
import '@/lib/livekit/logging';
import { useRoomConnectionStatus } from '@/lib/livekit/use-room-connection';
import type { RoomConnectionStatus } from '@/lib/livekit/use-room-connection';
import type { StudioConnection } from '@/types';

/**
 * The host's LiveKit room. Connects with the grant the page was given, stays connected across
 * Inertia visits back to the studio (going live hands down a fresh grant, which is ignored while
 * connected), and leaves on unmount. `reconnect` asks the server for a fresh grant and rejoins.
 */
export function useStudioRoom(connection: StudioConnection | null): {
    room: Room;
    status: RoomConnectionStatus;
    disconnectReason: DisconnectReason | undefined;
    reconnect: () => void;
} {
    // The host subscribes to nothing yet: students publish nothing until they are promoted
    // (SPEC §5 keeps subscriptions explicit on the host side).
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

        connectRoomOnce(room, serverUrl, token, { autoSubscribe: false }).catch(
            () => {
                if (active) {
                    setFailed(true);
                }
            },
        );

        return () => {
            active = false;
        };
    }, [room, serverUrl, token, attempt]);

    const reconnect = () => {
        setFailed(false);
        setDisconnectReason(undefined);
        router.reload({
            only: ['connection'],
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

/**
 * Publishes the camera and mic while the room is live and connected, and again after a rejoin
 * (a new connection starts with nothing published). A replaced track takes its old one's place.
 */
export function usePublishWhileLive(
    room: Room,
    live: boolean,
    connected: boolean,
    camera: LocalTrack | undefined,
    microphone: LocalTrack | undefined,
): void {
    useEffect(() => {
        if (!live || !connected) {
            return;
        }

        for (const track of [camera, microphone]) {
            if (!track) {
                continue;
            }

            const published = room.localParticipant.getTrackPublication(
                track.source,
            );

            if (published?.track === track) {
                continue;
            }

            void (async () => {
                if (published?.track) {
                    await room.localParticipant.unpublishTrack(
                        published.track,
                        false,
                    );
                }

                await room.localParticipant.publishTrack(track);
            })().catch(() => {
                toast.error(
                    track.source === Track.Source.Camera
                        ? 'Your camera could not be broadcast.'
                        : 'Your microphone could not be broadcast.',
                );
            });
        }
    }, [room, live, connected, camera, microphone]);
}

function subscribeToLocalPublications(room: Room, onStoreChange: () => void) {
    room.on(RoomEvent.LocalTrackPublished, onStoreChange);
    room.on(RoomEvent.LocalTrackUnpublished, onStoreChange);

    return () => {
        room.off(RoomEvent.LocalTrackPublished, onStoreChange);
        room.off(RoomEvent.LocalTrackUnpublished, onStoreChange);
    };
}

/**
 * The host's own screen share, if one is being broadcast, and a toggle for it. Stopping the
 * share from the browser's own "Stop sharing" bar unpublishes it too.
 */
export function useScreenShare(
    room: Room,
): [LocalVideoTrack | undefined, (enabled: boolean) => Promise<void>] {
    const track = useSyncExternalStore(
        (onStoreChange) => subscribeToLocalPublications(room, onStoreChange),
        () =>
            room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
                ?.videoTrack as LocalVideoTrack | undefined,
    );

    const setEnabled = async (enabled: boolean) => {
        try {
            await room.localParticipant.setScreenShareEnabled(enabled, {
                audio: true,
                selfBrowserSurface: 'exclude',
                surfaceSwitching: 'include',
                systemAudio: 'include',
            });
        } catch (error) {
            // Closing the browser's picker is a choice, not a failure.
            if (
                error instanceof DOMException &&
                error.name === 'NotAllowedError'
            ) {
                return;
            }

            toast.error('Your screen could not be shared.');
        }
    };

    return [track, setEnabled];
}

/**
 * Everyone else in the room. With a single host, that is the audience.
 */
export function useViewerCount(room: Room): number {
    return useSyncExternalStore(
        (onStoreChange) => {
            room.on(RoomEvent.ParticipantConnected, onStoreChange);
            room.on(RoomEvent.ParticipantDisconnected, onStoreChange);
            room.on(RoomEvent.ConnectionStateChanged, onStoreChange);

            return () => {
                room.off(RoomEvent.ParticipantConnected, onStoreChange);
                room.off(RoomEvent.ParticipantDisconnected, onStoreChange);
                room.off(RoomEvent.ConnectionStateChanged, onStoreChange);
            };
        },
        () => room.remoteParticipants.size,
    );
}
