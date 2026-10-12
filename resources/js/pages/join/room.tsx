import { Head, router } from '@inertiajs/react';
import { ConnectionState, DisconnectReason, RoomEvent } from 'livekit-client';
import type { Room as LiveKitRoom } from 'livekit-client';
import {
    Ban,
    CircleSlash,
    Clock,
    Hand,
    LogOut,
    Mic,
    MicOff,
    TriangleAlert,
    Users,
    Video,
    VideoOff,
    Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import JoinController from '@/actions/App/Http/Controllers/JoinController';
import {
    CameraTile,
    RemoteVideo,
    RoomAudio,
} from '@/components/livekit/remote-media';
import DeviceControl from '@/components/studio/device-control';
import TrackVideo from '@/components/studio/track-video';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useInitials } from '@/hooks/use-initials';
import {
    usePublishedTracks,
    useConnectedRoom,
} from '@/lib/livekit/use-connected-room';
import type { LiveKitConnection } from '@/lib/livekit/use-connected-room';
import { useOptionalTrack } from '@/lib/livekit/use-local-media';
import {
    stageOf,
    useCanPlayAudio,
    useRoomSnapshot,
} from '@/lib/livekit/use-stage';
import { cn } from '@/lib/utils';
import type { JoinableRoom } from '@/types';

type Refusal = 'expired' | 'ended' | 'cancelled' | 'removed' | 'full';

type Props = {
    slug: string;
    room: JoinableRoom;
    participant: { uuid: string; name: string; hand_raised: boolean };
    access: { connection: LiveKitConnection | null; refusal: Refusal | null };
};

/** Data topic the server uses for messages meant for one participant (StageService::TOPIC). */
const TOPIC = 'megaphone';

export default function ViewerRoom(props: Props) {
    return (
        <>
            <Head title={props.room.title} />
            {props.access.refusal ? (
                <RefusalNotice reason={props.access.refusal} />
            ) : (
                <Viewer {...props} />
            )}
        </>
    );
}

function Viewer({ slug, room, participant, access }: Props) {
    const {
        room: liveKitRoom,
        status,
        disconnectReason,
        reconnect,
    } = useConnectedRoom(access.connection, 'access');
    const connected = status === 'connected';

    const snapshot = useRoomSnapshot(liveKitRoom);
    const { host, screenShare, speakers } = stageOf(snapshot.remotes);
    const hostLive = host?.publishing ?? false;
    const onStage = connected && snapshot.canPublish;

    // Self-view is a local preview only (SPEC §4.4): nothing is sent until the host brings
    // this viewer on stage, which then makes the switch to speaking instant.
    const [selfView, setSelfView] = useState(false);
    const camera = useOptionalTrack('camera', selfView);
    const microphone = useOptionalTrack('microphone', onStage);

    usePublishedTracks(
        liveKitRoom,
        onStage,
        connected,
        camera.track,
        microphone.track,
    );

    useStageNotifications(liveKitRoom, onStage);

    const [handBusy, setHandBusy] = useState(false);
    const toggleHand = () => {
        router.visit(JoinController.hand(slug), {
            data: { raised: !participant.hand_raised },
            only: ['participant'],
            preserveState: true,
            preserveScroll: true,
            onStart: () => setHandBusy(true),
            onFinish: () => setHandBusy(false),
        });
    };

    const ended = disconnectReason === DisconnectReason.ROOM_DELETED;
    const removed = disconnectReason === DisconnectReason.PARTICIPANT_REMOVED;

    if (ended) {
        return <RefusalNotice reason="ended" />;
    }

    if (removed) {
        return <RefusalNotice reason="removed" />;
    }

    return (
        <div className="flex h-svh flex-col">
            <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
                <div className="min-w-0">
                    <h1 className="truncate font-medium">{room.title}</h1>
                    <p className="truncate text-sm text-muted-foreground">
                        Hosted by {room.host}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                    {hostLive ? (
                        <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                            <span className="size-1.5 animate-pulse rounded-full bg-white" />
                            Live
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            Not started
                        </span>
                    )}
                </div>
            </header>

            <ConnectionBanner
                state={snapshot.state}
                status={status}
                unreachable={access.connection === null}
                disconnectReason={disconnectReason}
                onReconnect={reconnect}
            />

            <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
                <section
                    aria-label="Stage"
                    className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-neutral-950"
                >
                    {screenShare ? (
                        <RemoteVideo
                            track={screenShare}
                            className="object-contain"
                        />
                    ) : host?.camera ? (
                        <RemoteVideo
                            track={host.camera}
                            className="object-contain"
                        />
                    ) : (
                        <StageEmpty
                            hostName={room.host}
                            hostLive={hostLive}
                            connecting={status === 'connecting'}
                        />
                    )}
                </section>

                <aside
                    aria-label="Speakers"
                    className={cn(
                        'flex shrink-0 gap-3 overflow-x-auto lg:w-64 lg:flex-col lg:overflow-y-auto',
                        !(screenShare && host) &&
                            speakers.length === 0 &&
                            !camera.track &&
                            'hidden',
                    )}
                >
                    {screenShare && host && (
                        <CameraTile
                            person={host}
                            label={`${host.name} (host)`}
                            className="aspect-video w-48 shrink-0 lg:w-full"
                        />
                    )}
                    {speakers.map((speaker) => (
                        <CameraTile
                            key={speaker.identity}
                            person={speaker}
                            className="aspect-video w-48 shrink-0 lg:w-full"
                        />
                    ))}
                    {camera.track && (
                        <SelfView
                            name={participant.name}
                            track={camera.track}
                            onStage={onStage}
                        />
                    )}
                </aside>
            </main>

            <footer className="flex flex-wrap items-center justify-center gap-3 border-t p-3">
                {onStage ? (
                    <>
                        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            <Mic className="size-4" />
                            You are on stage
                        </span>
                        <DeviceControl
                            track={microphone.track}
                            kind="audioinput"
                            label="Microphone"
                            icon={Mic}
                            mutedIcon={MicOff}
                        />
                    </>
                ) : (
                    <Button
                        variant={
                            participant.hand_raised ? 'default' : 'outline'
                        }
                        className={cn(
                            participant.hand_raised &&
                                'bg-amber-500 text-black hover:bg-amber-500/90',
                        )}
                        aria-pressed={participant.hand_raised}
                        disabled={handBusy || !connected || !hostLive}
                        title={
                            hostLive
                                ? undefined
                                : 'You can raise your hand once the host is live.'
                        }
                        onClick={toggleHand}
                    >
                        {handBusy ? <Spinner /> : <Hand />}
                        {participant.hand_raised ? 'Lower hand' : 'Raise hand'}
                    </Button>
                )}

                <Button
                    variant={
                        selfView && !camera.failure ? 'secondary' : 'outline'
                    }
                    aria-pressed={selfView}
                    title={
                        camera.failure === 'denied'
                            ? 'Allow camera access in your browser’s site settings, then try again.'
                            : undefined
                    }
                    onClick={() => setSelfView((value) => !value)}
                >
                    {selfView && !camera.failure ? <Video /> : <VideoOff />}
                    {camera.failure && selfView
                        ? camera.failure === 'denied'
                            ? 'Camera blocked'
                            : 'No camera found'
                        : selfView
                          ? 'Camera on'
                          : 'Camera off'}
                </Button>

                <Button
                    variant="ghost"
                    onClick={() => router.visit(JoinController.show(slug))}
                >
                    <LogOut />
                    Leave
                </Button>
            </footer>

            <RoomAudio remotes={snapshot.remotes} />
            <AudioUnlock room={liveKitRoom} />
        </div>
    );
}

/**
 * Toasts for being brought on stage or sent back, and for the host lowering a hand, which
 * arrives as a data message on this viewer's own connection.
 */
function useStageNotifications(room: LiveKitRoom, onStage: boolean) {
    const wasOnStage = useRef(onStage);

    useEffect(() => {
        if (onStage === wasOnStage.current) {
            return;
        }

        wasOnStage.current = onStage;
        toast(
            onStage
                ? 'You are on stage. Everyone can hear you; turn your camera on to be seen.'
                : 'You are back in the audience.',
        );
        // Being promoted lowers the hand server-side.
        router.reload({ only: ['participant'] });
    }, [onStage]);

    useEffect(() => {
        const handleData = (
            payload: Uint8Array,
            _participant: unknown,
            _kind: unknown,
            topic?: string,
        ) => {
            if (topic !== TOPIC) {
                return;
            }

            try {
                const message = JSON.parse(
                    new TextDecoder().decode(payload),
                ) as {
                    type?: string;
                };

                if (message.type === 'hand.lowered') {
                    toast('The host lowered your hand.');
                    router.reload({ only: ['participant'] });
                }
            } catch {
                // Not ours to read.
            }
        };

        room.on(RoomEvent.DataReceived, handleData);

        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room]);
}

function StageEmpty({
    hostName,
    hostLive,
    connecting,
}: {
    hostName: string;
    hostLive: boolean;
    connecting: boolean;
}) {
    const getInitials = useInitials();

    if (connecting) {
        return (
            <p className="flex items-center gap-2 text-sm text-neutral-400">
                <Spinner />
                Joining…
            </p>
        );
    }

    if (hostLive) {
        return (
            <div className="flex flex-col items-center gap-3 text-neutral-400">
                <div className="flex size-20 items-center justify-center rounded-full bg-neutral-800 text-2xl font-medium text-neutral-200">
                    {getInitials(hostName)}
                </div>
                <p className="flex items-center gap-2 text-sm">
                    <VideoOff className="size-4" />
                    {hostName}’s camera is off
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-xs space-y-2 px-6 text-center">
            <Clock className="mx-auto size-8 text-neutral-500" />
            <p className="font-medium text-neutral-100">
                Waiting for the host to start
            </p>
            <p className="text-sm text-neutral-400">
                The stream starts here automatically when {hostName} goes live.
            </p>
        </div>
    );
}

function SelfView({
    name,
    track,
    onStage,
}: {
    name: string;
    track: NonNullable<ReturnType<typeof useOptionalTrack<'camera'>>['track']>;
    onStage: boolean;
}) {
    return (
        <figure className="relative aspect-video w-48 shrink-0 overflow-hidden rounded-lg bg-neutral-900 lg:w-full">
            {/* Mirrored, as people expect to see themselves. */}
            <TrackVideo track={track} className="-scale-x-100 object-cover" />
            <figcaption className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                {name} (you{onStage ? '' : ', only you can see this'})
            </figcaption>
        </figure>
    );
}

/**
 * Browsers may block sound until the person clicks something on the page.
 */
function AudioUnlock({ room }: { room: LiveKitRoom }) {
    const canPlay = useCanPlayAudio(room);

    if (canPlay) {
        return null;
    }

    return (
        <div className="fixed inset-x-0 bottom-20 flex justify-center">
            <Button
                onClick={() => void room.startAudio()}
                className="shadow-lg"
            >
                <Volume2 />
                Turn on sound
            </Button>
        </div>
    );
}

function ConnectionBanner({
    state,
    status,
    unreachable,
    disconnectReason,
    onReconnect,
}: {
    state: ConnectionState;
    status: string;
    unreachable: boolean;
    disconnectReason: DisconnectReason | undefined;
    onReconnect: () => void;
}) {
    if (status !== 'interrupted') {
        return null;
    }

    if (state !== ConnectionState.Disconnected && !unreachable) {
        return (
            <p
                role="status"
                className="flex items-center justify-center gap-2 bg-muted px-4 py-2 text-sm"
            >
                <Spinner />
                Reconnecting…
            </p>
        );
    }

    const duplicate = disconnectReason === DisconnectReason.DUPLICATE_IDENTITY;

    return (
        <div
            role="alert"
            className="flex flex-wrap items-center justify-center gap-3 bg-destructive/10 px-4 py-2 text-sm"
        >
            <TriangleAlert className="size-4 text-destructive" />
            {duplicate
                ? 'You opened this webinar in another tab or window.'
                : 'You are disconnected from the webinar.'}
            <Button variant="outline" size="sm" onClick={onReconnect}>
                {duplicate ? 'Watch here instead' : 'Reconnect'}
            </Button>
        </div>
    );
}

const refusals: Record<
    Refusal,
    { icon: LucideIcon; title: string; description: string; retry?: boolean }
> = {
    expired: {
        icon: CircleSlash,
        title: 'This link has expired',
        description: 'Ask whoever sent it to you for a new link.',
    },
    ended: {
        icon: CircleSlash,
        title: 'This webinar has ended',
        description: 'Thanks for watching.',
    },
    cancelled: {
        icon: CircleSlash,
        title: 'This webinar was cancelled',
        description: 'The session will not take place.',
    },
    removed: {
        icon: Ban,
        title: 'You were removed from this webinar',
        description: 'The host removed you, so you cannot rejoin it.',
    },
    full: {
        icon: Users,
        title: 'This webinar is full',
        description: 'Try again in a little while, when someone leaves.',
        retry: true,
    },
};

function RefusalNotice({ reason }: { reason: Refusal }) {
    const { icon: Icon, title, description, retry } = refusals[reason];
    const [retrying, setRetrying] = useState(false);

    return (
        <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-sm space-y-3 text-center">
                <Icon className="mx-auto size-8 text-muted-foreground" />
                <h1 className="text-xl font-semibold tracking-tight">
                    {title}
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
                {retry && (
                    <Button
                        variant="outline"
                        disabled={retrying}
                        onClick={() =>
                            router.reload({
                                only: ['access'],
                                onStart: () => setRetrying(true),
                                onFinish: () => setRetrying(false),
                            })
                        }
                    >
                        {retrying && <Spinner />}
                        Try again
                    </Button>
                )}
            </div>
        </div>
    );
}
