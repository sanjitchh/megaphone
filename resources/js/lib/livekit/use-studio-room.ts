import { RoomEvent, Track } from 'livekit-client';
import type { LocalVideoTrack, Room } from 'livekit-client';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useConnectedRoom } from '@/lib/livekit/use-connected-room';
import type { StudioConnection } from '@/types';

/**
 * The host's LiveKit room, reconnecting with a fresh `connection` grant.
 */
export function useStudioRoom(connection: StudioConnection | null) {
    return useConnectedRoom(connection, 'connection');
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
