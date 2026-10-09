import type { LocalVideoTrack } from 'livekit-client';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Plays a local video track. LiveKit keeps the element fed when the track restarts
 * (a device switch, or unmuting a camera that muting stopped).
 */
export default function TrackVideo({
    track,
    className,
}: {
    track: LocalVideoTrack;
    className?: string;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const element = videoRef.current;

        if (!element) {
            return;
        }

        track.attach(element);

        return () => {
            track.detach(element);
        };
    }, [track]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn('size-full', className)}
        />
    );
}
