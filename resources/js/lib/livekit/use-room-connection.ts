import { ConnectionState, RoomEvent } from 'livekit-client';
import type { Room } from 'livekit-client';
import { useSyncExternalStore } from 'react';

// Ported from Sentinel (sentinel-proctor/lib/livekit/use-room-connection.ts).

export type RoomConnectionStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'interrupted';

// A fresh Room sits in Disconnected before it has ever tried, which is
// indistinguishable from a drop by state alone. Tracked per Room rather than per
// component so the answer survives a remount, and keyed weakly so a discarded
// Room is collectable.
const everConnected = new WeakMap<Room, boolean>();

function markConnected(room: Room): void {
    if (room.state === ConnectionState.Connected) {
        everConnected.set(room, true);
    }
}

// Derived from the room's own state rather than tracked locally: a cached
// "connected" that disagrees with the room is how you publish into a dead
// connection — and how a warning stays hidden while the socket is down.
// `failed` folds in a connect that never landed, which otherwise leaves the
// room parked in Disconnected and reads as a permanent "connecting".
export function useRoomConnectionStatus(
    room: Room | undefined,
    failed = false,
): RoomConnectionStatus {
    return useSyncExternalStore(
        (onStoreChange) => {
            if (!room) {
                return () => undefined;
            }

            // The room may already be connected when a later consumer subscribes.
            markConnected(room);

            const handleChange = () => {
                markConnected(room);
                onStoreChange();
            };

            room.on(RoomEvent.ConnectionStateChanged, handleChange);

            return () => {
                room.off(RoomEvent.ConnectionStateChanged, handleChange);
            };
        },
        () => {
            if (!room) {
                return 'idle';
            }

            if (failed) {
                return 'interrupted';
            }

            switch (room.state) {
                case ConnectionState.Connected:
                    return 'connected';
                case ConnectionState.Reconnecting:
                case ConnectionState.SignalReconnecting:
                    return 'interrupted';
                case ConnectionState.Disconnected:
                    // Only a drop *after* a successful connect is a real interruption.
                    return everConnected.get(room)
                        ? 'interrupted'
                        : 'connecting';
                default:
                    return 'connecting';
            }
        },
        () => 'idle',
    );
}
