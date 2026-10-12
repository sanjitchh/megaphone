import { Head, router } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import { toast } from 'sonner';
import { ConnectionState, DisconnectReason } from 'livekit-client';
import {
    Check,
    Copy,
    Link2,
    Mic,
    MicOff,
    Radio,
    ScreenShare,
    ScreenShareOff,
    TriangleAlert,
    Video,
    VideoOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import RoomStudioController from '@/actions/App/Http/Controllers/RoomStudioController';
import Heading from '@/components/heading';
import RoomStatusBadge from '@/components/rooms/room-status-badge';
import { CameraTile, RoomAudio } from '@/components/livekit/remote-media';
import DeviceControl from '@/components/studio/device-control';
import EndSessionDialog from '@/components/studio/end-session-dialog';
import MicLevel from '@/components/studio/mic-level';
import ParticipantsPanel from '@/components/studio/participants-panel';
import StagePreview from '@/components/studio/stage-preview';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatSchedule } from '@/lib/datetime';
import { useLocalMedia, useTrackMuted } from '@/lib/livekit/use-local-media';
import type { MediaFailure } from '@/lib/livekit/use-local-media';
import type { RoomConnectionStatus } from '@/lib/livekit/use-room-connection';
import { usePublishedTracks } from '@/lib/livekit/use-connected-room';
import { stageOf, useRoomSnapshot } from '@/lib/livekit/use-stage';
import { useScreenShare, useStudioRoom } from '@/lib/livekit/use-studio-room';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';
import type { Room, RoomLink, StageState, StudioConnection } from '@/types';

type StudioProps = {
    room: Room;
    connection: StudioConnection | null;
    links: RoomLink[];
    stage: StageState;
};

export default function Studio(props: StudioProps) {
    return props.room.can.open_studio ? (
        <StudioConsole {...props} />
    ) : (
        <SessionOver room={props.room} />
    );
}

function StudioConsole({ room, connection, links, stage }: StudioProps) {
    const live = room.status === 'LIVE';
    const hostName = room.host?.name ?? 'Host';

    const {
        room: liveKitRoom,
        status,
        disconnectReason,
        reconnect,
    } = useStudioRoom(connection);
    const connected = status === 'connected';
    const media = useLocalMedia();
    const cameraOff = useTrackMuted(media.camera);
    const [screenShare, setScreenShareEnabled] = useScreenShare(liveKitRoom);
    const snapshot = useRoomSnapshot(liveKitRoom);
    const { speakers } = stageOf(snapshot.remotes);
    const [goingLive, setGoingLive] = useState(false);
    const [ending, setEnding] = useState(false);

    usePublishedTracks(
        liveKitRoom,
        live,
        connected,
        media.camera,
        media.microphone,
    );

    // Hands and the stage change server-side; the studio hears about it and reloads them.
    useEcho<{ type: string; participant: { uuid: string; name: string } }>(
        `rooms.${room.uuid}.studio`,
        '.stage.changed',
        (event) => {
            if (event.type === 'HAND.RAISED') {
                toast(`${event.participant.name} raised their hand`);
            }

            router.reload({ only: ['stage'] });
        },
    );

    // Closing this tab drops the broadcast for everyone watching, so make the browser ask first.
    useEffect(() => {
        if (!live) {
            return;
        }

        const confirmLeave = (event: BeforeUnloadEvent) =>
            event.preventDefault();

        window.addEventListener('beforeunload', confirmLeave);

        return () => window.removeEventListener('beforeunload', confirmLeave);
    }, [live]);

    const goLive = () => {
        router.visit(RoomStudioController.goLive(room.uuid), {
            // Stay mounted: remounting would drop the connection and the open devices.
            preserveState: true,
            preserveScroll: true,
            onStart: () => setGoingLive(true),
            onFinish: () => setGoingLive(false),
        });
    };

    return (
        <>
            <Head title={`Studio · ${room.title}`} />

            <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col gap-6 p-4 lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <Heading
                            title={room.title}
                            description={
                                live && room.started_at
                                    ? undefined
                                    : formatSchedule(
                                          room.starts_at,
                                          room.ends_at,
                                      )
                            }
                        />
                        <RoomStatusBadge status={room.status} />
                        {live && room.started_at && (
                            <OnAirFor startedAt={room.started_at} />
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {room.can.go_live && (
                            <Button
                                onClick={goLive}
                                disabled={!connected || goingLive}
                            >
                                {goingLive ? <Spinner /> : <Radio />}
                                Go live
                            </Button>
                        )}
                        {room.can.end && (
                            <EndSessionDialog
                                room={room}
                                onEnding={setEnding}
                            />
                        )}
                    </div>
                </div>

                {!ending && (
                    <ConnectionAlert
                        state={snapshot.state}
                        status={status}
                        unreachable={connection === null}
                        disconnectReason={disconnectReason}
                        onReconnect={reconnect}
                    />
                )}

                <MediaAlert
                    camera={media.cameraFailure}
                    microphone={media.microphoneFailure}
                    onRetry={media.retry}
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="space-y-3">
                        <StagePreview
                            camera={media.camera}
                            cameraOff={cameraOff}
                            screenShare={screenShare}
                            hostName={hostName}
                            live={live}
                        />

                        {speakers.length > 0 && (
                            <ul
                                aria-label="On stage"
                                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                            >
                                {speakers.map((speaker) => (
                                    <li key={speaker.identity}>
                                        <CameraTile
                                            person={speaker}
                                            className="aspect-video"
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}

                        <RoomAudio remotes={snapshot.remotes} />

                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <DeviceControl
                                        track={media.microphone}
                                        kind="audioinput"
                                        label="Microphone"
                                        icon={Mic}
                                        mutedIcon={MicOff}
                                    />
                                    {media.microphone && (
                                        <MicLevel track={media.microphone} />
                                    )}
                                </div>
                                <DeviceControl
                                    track={media.camera}
                                    kind="videoinput"
                                    label="Camera"
                                    icon={Video}
                                    mutedIcon={VideoOff}
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                {!live && (
                                    <span className="text-xs text-muted-foreground">
                                        Screen sharing opens once you are live.
                                    </span>
                                )}
                                <Button
                                    variant={
                                        screenShare ? 'default' : 'outline'
                                    }
                                    disabled={!live || !connected}
                                    aria-pressed={!!screenShare}
                                    onClick={() =>
                                        void setScreenShareEnabled(!screenShare)
                                    }
                                >
                                    {screenShare ? (
                                        <>
                                            <ScreenShareOff />
                                            Stop sharing
                                        </>
                                    ) : (
                                        <>
                                            <ScreenShare />
                                            Share screen
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <ParticipantsPanel
                            room={room}
                            remotes={snapshot.remotes}
                            connected={connected}
                            stage={stage}
                        />

                        <p className="px-1 text-sm text-muted-foreground">
                            {live
                                ? 'Closing this tab keeps the session live, but viewers lose you. End it to disconnect everyone.'
                                : 'Your camera and mic go out when you go live.'}
                        </p>

                        <ShareLinks links={links} />

                        <ConnectionIndicator status={status} />
                    </aside>
                </div>
            </div>
        </>
    );
}

/** "On air 1:02:03", ticking every second. */
function OnAirFor({ startedAt }: { startedAt: string }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(timer);
    }, []);

    const seconds = Math.max(
        0,
        Math.floor((now - new Date(startedAt).getTime()) / 1000),
    );
    const pad = (value: number) => String(value).padStart(2, '0');
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const elapsed =
        hours > 0
            ? `${hours}:${pad(minutes)}:${pad(seconds % 60)}`
            : `${minutes}:${pad(seconds % 60)}`;

    return (
        <span className="pt-0.5 text-sm text-muted-foreground tabular-nums">
            On air {elapsed}
        </span>
    );
}

const connectionLabels: Record<RoomConnectionStatus, string> = {
    idle: 'Not connected',
    connecting: 'Connecting…',
    connected: 'Connected',
    interrupted: 'Connection lost',
};

function ConnectionIndicator({ status }: { status: RoomConnectionStatus }) {
    return (
        <p
            className="flex items-center gap-2 px-1 text-sm text-muted-foreground"
            aria-live="polite"
        >
            <span
                className={cn(
                    'size-2 rounded-full',
                    status === 'connected' && 'bg-emerald-500',
                    status === 'connecting' && 'animate-pulse bg-amber-500',
                    (status === 'interrupted' || status === 'idle') &&
                        'bg-destructive',
                )}
            />
            {connectionLabels[status]}
        </p>
    );
}

function ConnectionAlert({
    state,
    status,
    unreachable,
    disconnectReason,
    onReconnect,
}: {
    state: ConnectionState;
    status: RoomConnectionStatus;
    unreachable: boolean;
    disconnectReason: DisconnectReason | undefined;
    onReconnect: () => void;
}) {
    if (status !== 'interrupted') {
        return null;
    }

    // The SDK is healing a blip on its own; a second join now would abort it.
    if (state !== ConnectionState.Disconnected && !unreachable) {
        return (
            <Alert>
                <Spinner />
                <AlertTitle>Reconnecting…</AlertTitle>
                <AlertDescription>
                    Viewers may see your video freeze for a moment.
                </AlertDescription>
            </Alert>
        );
    }

    // Ended from somewhere else (another tab): there is nothing left to rejoin.
    if (disconnectReason === DisconnectReason.ROOM_DELETED) {
        return (
            <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>The session has ended.</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>Everyone has been disconnected.</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.reload()}
                    >
                        Done
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>
                {disconnectReason === DisconnectReason.DUPLICATE_IDENTITY
                    ? 'The studio was opened in another tab or window.'
                    : 'You are disconnected from the media server.'}
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>
                    {disconnectReason === DisconnectReason.DUPLICATE_IDENTITY
                        ? 'Only one studio can broadcast at a time.'
                        : 'Viewers cannot see or hear you until you reconnect.'}
                </span>
                <Button variant="outline" size="sm" onClick={onReconnect}>
                    {disconnectReason === DisconnectReason.DUPLICATE_IDENTITY
                        ? 'Use this tab'
                        : 'Reconnect'}
                </Button>
            </AlertDescription>
        </Alert>
    );
}

const failureText: Record<MediaFailure, string> = {
    denied: 'access was blocked',
    unavailable: 'none was found',
};

function MediaAlert({
    camera,
    microphone,
    onRetry,
}: {
    camera: MediaFailure | undefined;
    microphone: MediaFailure | undefined;
    onRetry: () => void;
}) {
    if (!camera && !microphone) {
        return null;
    }

    const problems = [
        camera && `Camera: ${failureText[camera]}.`,
        microphone && `Microphone: ${failureText[microphone]}.`,
    ].filter(Boolean);

    return (
        <Alert>
            <TriangleAlert />
            <AlertTitle>Some of your devices are not available</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>
                    {problems.join(' ')}{' '}
                    {(camera === 'denied' || microphone === 'denied') &&
                        'Allow access in your browser’s site settings, then try again.'}
                </span>
                <Button variant="outline" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            </AlertDescription>
        </Alert>
    );
}

function ShareLinks({ links }: { links: RoomLink[] }) {
    const [copiedText, copy] = useClipboard();

    return (
        <section className="space-y-3 rounded-xl border p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="size-4 text-muted-foreground" />
                Share links
            </h3>
            {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No active links. Create one from the room’s page.
                </p>
            ) : (
                <ul className="space-y-1">
                    {links.map((link) => (
                        <li
                            key={link.uuid}
                            className="flex items-center justify-between gap-2"
                        >
                            <span className="min-w-0 truncate text-sm">
                                {link.label ?? 'Untitled link'}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Copy ${link.label ?? 'untitled link'}`}
                                onClick={() => void copy(link.url)}
                            >
                                {copiedText === link.url ? <Check /> : <Copy />}
                                {copiedText === link.url ? 'Copied' : 'Copy'}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

/**
 * A finished room: the studio tab stays put (no jump back to the dashboard) and says so.
 */
function SessionOver({ room }: { room: Room }) {
    return (
        <>
            <Head title={`Studio · ${room.title}`} />

            <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-sm space-y-4 text-center">
                    <RoomStatusBadge status={room.status} />
                    <h1 className="text-xl font-semibold tracking-tight">
                        {room.status === 'CANCELLED'
                            ? 'This session was cancelled'
                            : 'This session has ended'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {room.title}
                        {room.started_at && room.ended_at && (
                            <>
                                <br />
                                <span className="tabular-nums">
                                    {formatSchedule(
                                        room.started_at,
                                        room.ended_at,
                                    )}
                                </span>
                            </>
                        )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Everyone has been disconnected. You can close this tab.
                    </p>
                    <Button variant="outline" onClick={() => window.close()}>
                        Close tab
                    </Button>
                </div>
            </div>
        </>
    );
}
