import { ConnectionState, RoomEvent } from 'livekit-client';
import type { Room, RoomConnectOptions } from 'livekit-client';

// Ported from Sentinel (sentinel-proctor/lib/livekit/connect-room.ts).

const pending = new WeakMap<Room, Promise<void>>();
const draining = new WeakMap<Room, Promise<void>>();

/**
 * Resolves when the Room reaches Connected and rejects when it reaches Disconnected, without
 * touching the connection — for a Room the SDK is still connecting or healing.
 */
export function settleRoomConnection(room: Room): Promise<void> {
    if (room.state === ConnectionState.Connected) {
        return Promise.resolve();
    }

    if (room.state === ConnectionState.Disconnected) {
        return Promise.reject(new Error('room is disconnected'));
    }

    return new Promise((resolve, reject) => {
        const handleStateChange = (state: ConnectionState) => {
            if (state === ConnectionState.Connected) {
                room.off(RoomEvent.ConnectionStateChanged, handleStateChange);
                resolve();
            } else if (state === ConnectionState.Disconnected) {
                room.off(RoomEvent.ConnectionStateChanged, handleStateChange);
                reject(new Error('room disconnected before it settled'));
            }
        };

        room.on(RoomEvent.ConnectionStateChanged, handleStateChange);
    });
}

/**
 * Joins only from Disconnected. A Room that is connecting or reconnecting is waited on
 * instead: `connect()` there starts a second join that aborts the SDK's own resume.
 * Overlapping calls share one attempt, and a call made while `disconnectRoom` is still
 * leaving joins again once it has left.
 */
export function connectRoomOnce(
    room: Room,
    serverUrl: string,
    token: string,
    options?: RoomConnectOptions,
): Promise<void> {
    const leaving = draining.get(room);

    if (leaving) {
        return leaving.then(() =>
            connectRoomOnce(room, serverUrl, token, options),
        );
    }

    if (room.state === ConnectionState.Connected) {
        return Promise.resolve();
    }

    const inFlight = pending.get(room);

    if (inFlight) {
        return inFlight;
    }

    if (room.state !== ConnectionState.Disconnected) {
        return settleRoomConnection(room);
    }

    const attempt = room.connect(serverUrl, token, options).finally(() => {
        if (pending.get(room) === attempt) {
            pending.delete(room);
        }
    });
    pending.set(room, attempt);

    return attempt;
}

/**
 * Leaves the Room and drops any attempt `connectRoomOnce` is sharing, so a connect that
 * follows (a remount) joins afresh instead of inheriting the one this cancels.
 */
export function disconnectRoom(room: Room): Promise<void> {
    pending.delete(room);

    const leaving = room
        .disconnect()
        .catch(() => undefined)
        .finally(() => {
            if (draining.get(room) === leaving) {
                draining.delete(room);
            }
        });
    draining.set(room, leaving);

    return leaving;
}
