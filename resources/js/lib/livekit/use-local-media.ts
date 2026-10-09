import {
    createLocalAudioTrack,
    createLocalVideoTrack,
    Room,
    TrackEvent,
    VideoPresets,
} from 'livekit-client';
import type {
    LocalAudioTrack,
    LocalTrack,
    LocalVideoTrack,
} from 'livekit-client';
import { useEffect, useState, useSyncExternalStore } from 'react';

/** Why a device could not be opened: the user (or a policy) said no, or there is none. */
export type MediaFailure = 'denied' | 'unavailable';

type LocalMedia = {
    camera?: LocalVideoTrack;
    microphone?: LocalAudioTrack;
    cameraFailure?: MediaFailure;
    microphoneFailure?: MediaFailure;
};

function classify(error: unknown): MediaFailure {
    return error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError')
        ? 'denied'
        : 'unavailable';
}

/**
 * Opens the host's camera and microphone as local tracks, unpublished: they preview in the
 * studio before going live and are published as-is when the broadcast starts. Each device
 * opens on its own, so a missing camera still leaves a working mic. Both stop on unmount.
 */
export function useLocalMedia(): LocalMedia & { retry: () => void } {
    const [media, setMedia] = useState<LocalMedia>({});
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        const opened: LocalTrack[] = [];

        void Promise.allSettled([
            createLocalVideoTrack({
                resolution: VideoPresets.h720.resolution,
            }),
            createLocalAudioTrack({
                echoCancellation: true,
                noiseSuppression: true,
            }),
        ]).then(([camera, microphone]) => {
            for (const result of [camera, microphone]) {
                if (result.status === 'fulfilled') {
                    opened.push(result.value);
                }
            }

            if (!active) {
                opened.forEach((track) => track.stop());

                return;
            }

            setMedia({
                camera:
                    camera.status === 'fulfilled' ? camera.value : undefined,
                microphone:
                    microphone.status === 'fulfilled'
                        ? microphone.value
                        : undefined,
                cameraFailure:
                    camera.status === 'rejected'
                        ? classify(camera.reason)
                        : undefined,
                microphoneFailure:
                    microphone.status === 'rejected'
                        ? classify(microphone.reason)
                        : undefined,
            });
        });

        return () => {
            active = false;
            opened.forEach((track) => track.stop());
        };
    }, [attempt]);

    return { ...media, retry: () => setAttempt((value) => value + 1) };
}

/**
 * Whether a local track is muted. Muting the camera stops it, so its light goes off too.
 */
export function useTrackMuted(track: LocalTrack | undefined): boolean {
    return useSyncExternalStore(
        (onStoreChange) => {
            if (!track) {
                return () => undefined;
            }

            track.on(TrackEvent.Muted, onStoreChange);
            track.on(TrackEvent.Unmuted, onStoreChange);

            return () => {
                track.off(TrackEvent.Muted, onStoreChange);
                track.off(TrackEvent.Unmuted, onStoreChange);
            };
        },
        () => track?.isMuted ?? true,
        () => true,
    );
}

/**
 * The devices of one kind, kept current as they are plugged in and out. Labels are only
 * filled in once the browser has granted access, so this waits for an open track.
 */
export function useMediaDevices(
    kind: MediaDeviceKind,
    track: LocalTrack | undefined,
): MediaDeviceInfo[] {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        if (!track) {
            return;
        }

        let active = true;

        const refresh = () => {
            void Room.getLocalDevices(kind, false).then((found) => {
                if (active) {
                    setDevices(found.filter((device) => device.deviceId));
                }
            });
        };

        refresh();
        navigator.mediaDevices.addEventListener('devicechange', refresh);

        return () => {
            active = false;
            navigator.mediaDevices.removeEventListener('devicechange', refresh);
        };
    }, [kind, track]);

    return devices;
}
