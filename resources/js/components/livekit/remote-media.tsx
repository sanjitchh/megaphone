import type { RemoteAudioTrack, RemoteVideoTrack } from 'livekit-client';
import { MicOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useInitials } from '@/hooks/use-initials';
import type { RemotePerson } from '@/lib/livekit/use-stage';
import { cn } from '@/lib/utils';

/**
 * Plays a subscribed remote video track; adaptiveStream sizes the stream to this element.
 */
export function RemoteVideo({
    track,
    className,
}: {
    track: RemoteVideoTrack;
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

/**
 * A participant's camera, or their initials while it is off.
 */
export function CameraTile({
    person,
    label,
    className,
}: {
    person: RemotePerson;
    label?: string;
    className?: string;
}) {
    const getInitials = useInitials();
    const name = person.name;

    return (
        <figure
            className={cn(
                'relative overflow-hidden rounded-lg bg-neutral-900',
                className,
            )}
        >
            {person.camera ? (
                <RemoteVideo track={person.camera} className="object-cover" />
            ) : (
                <div className="flex size-full items-center justify-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-neutral-800 text-sm font-medium text-neutral-200">
                        {getInitials(name)}
                    </div>
                </div>
            )}
            <figcaption className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                {!person.microphoneOn && (
                    <MicOff className="size-3 shrink-0" aria-label="Muted" />
                )}
                <span className="truncate">{label ?? name}</span>
            </figcaption>
        </figure>
    );
}

function RemoteAudio({ track }: { track: RemoteAudioTrack }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const element = audioRef.current;

        if (!element) {
            return;
        }

        track.attach(element);

        return () => {
            track.detach(element);
        };
    }, [track]);

    return <audio ref={audioRef} autoPlay />;
}

/**
 * Plays every subscribed audio track in the room: the host, screen-share audio, speakers.
 */
export function RoomAudio({ remotes }: { remotes: RemotePerson[] }) {
    const tracks = remotes.flatMap((person) => person.audio);

    return (
        <div hidden>
            {tracks.map((track) => (
                <RemoteAudio key={track.sid} track={track} />
            ))}
        </div>
    );
}
