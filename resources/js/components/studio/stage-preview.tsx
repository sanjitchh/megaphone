import type { LocalVideoTrack } from 'livekit-client';
import { VideoOff } from 'lucide-react';
import TrackVideo from '@/components/studio/track-video';
import { useInitials } from '@/hooks/use-initials';

/**
 * What viewers see (SPEC §4.4): the screen share takes centre stage with the host's
 * camera beside it; otherwise the camera fills the stage. Not mirrored, unlike a
 * typical self-view, because this is the picture the audience gets.
 */
export default function StagePreview({
    camera,
    cameraOff,
    screenShare,
    hostName,
    live,
}: {
    camera: LocalVideoTrack | undefined;
    cameraOff: boolean;
    screenShare: LocalVideoTrack | undefined;
    hostName: string;
    live: boolean;
}) {
    const getInitials = useInitials();
    const showCamera = camera && !cameraOff;

    return (
        <figure className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-950">
            {screenShare ? (
                <TrackVideo track={screenShare} className="object-contain" />
            ) : showCamera ? (
                <TrackVideo track={camera} className="object-cover" />
            ) : (
                <div className="flex size-full flex-col items-center justify-center gap-3 text-neutral-400">
                    <div className="flex size-20 items-center justify-center rounded-full bg-neutral-800 text-2xl font-medium text-neutral-200">
                        {getInitials(hostName)}
                    </div>
                    <p className="flex items-center gap-2 text-sm">
                        <VideoOff className="size-4" />
                        Camera off
                    </p>
                </div>
            )}

            {screenShare && showCamera && (
                <div className="absolute right-3 bottom-3 aspect-video w-1/5 min-w-28 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/20">
                    <TrackVideo track={camera} className="object-cover" />
                </div>
            )}

            <figcaption className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                {live ? (
                    <>
                        <span className="size-2 animate-pulse rounded-full bg-red-500" />
                        On air
                    </>
                ) : (
                    'Preview · viewers see “Waiting for the host”'
                )}
            </figcaption>
        </figure>
    );
}
