import { createAudioAnalyser, TrackEvent } from 'livekit-client';
import type { LocalAudioTrack } from 'livekit-client';
import { useEffect, useRef } from 'react';

/**
 * A live input meter for the mic check. It reads a clone of the track, so it keeps
 * moving while muted: "you are muted, but we can hear you" is worth seeing.
 * Updated straight on the element every frame, without re-rendering.
 */
export default function MicLevel({ track }: { track: LocalAudioTrack }) {
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let analyser = createAudioAnalyser(track, { cloneTrack: true });
        let frame = requestAnimationFrame(function draw() {
            const level = Math.min(1, analyser.calculateVolume() * 2.5);

            barRef.current?.style.setProperty('--level', String(level));
            frame = requestAnimationFrame(draw);
        });

        // A device switch replaces the underlying MediaStreamTrack the clone was taken from.
        const handleRestarted = () => {
            void analyser.cleanup();
            analyser = createAudioAnalyser(track, { cloneTrack: true });
        };

        track.on(TrackEvent.Restarted, handleRestarted);

        return () => {
            cancelAnimationFrame(frame);
            track.off(TrackEvent.Restarted, handleRestarted);
            void analyser.cleanup();
        };
    }, [track]);

    return (
        <div
            role="presentation"
            className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        >
            <div
                ref={barRef}
                className="h-full origin-left scale-x-(--level) rounded-full bg-primary transition-transform duration-75 [--level:0]"
            />
        </div>
    );
}
