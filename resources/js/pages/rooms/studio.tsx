import { Head, Link, router } from '@inertiajs/react';
import { ConnectionState, DisconnectReason } from 'livekit-client';
import type { Room as LiveKitRoom } from 'livekit-client';
import {
    Link2,
    Mic,
    MicOff,
    Radio,
    ScreenShare,
    ScreenShareOff,
    TriangleAlert,
    Users,
    Video,
    VideoOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import RoomStudioController from '@/actions/App/Http/Controllers/RoomStudioController';
import Heading from '@/components/heading';
import RoomStatusBadge from '@/components/rooms/room-status-badge';
import DeviceControl from '@/components/studio/device-control';
import EndSessionDialog from '@/components/studio/end-session-dialog';
import MicLevel from '@/components/studio/mic-level';
import StagePreview from '@/components/studio/stage-preview';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatSchedule } from '@/lib/datetime';
import { useLocalMedia, useTrackMuted } from '@/lib/livekit/use-local-media';
import type { MediaFailure } from '@/lib/livekit/use-local-media';
import type { RoomConnectionStatus } from '@/lib/livekit/use-room-connection';
import {
    usePublishWhileLive,
    useScreenShare,
    useStudioRoom,
    useViewerCount,
} from '@/lib/livekit/use-studio-room';
import { cn } from '@/lib/utils';
import { edit, index, studio } from '@/routes/rooms';
import type { Room, StudioConnection } from '@/types';

const numberFormat = new Intl.NumberFormat();

export default function Studio({
    room,
    connection,
}: {
    room: Room;
    connection: StudioConnection | null;
}) {
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
    const viewers = useViewerCount(liveKitRoom);
    const [goingLive, setGoingLive] = useState(false);
    const [ending, setEnding] = useState(false);

    usePublishWhileLive(
        liveKitRoom,
        live,
        connected,
        media.camera,
        media.microphone,
    );

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

            <div className="flex h-full flex-1 flex-col gap-6 p-4">
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
                        roomUuid={room.uuid}
                        room={liveKitRoom}
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
                        <section className="space-y-2 rounded-xl border p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium">
                                <Users className="size-4 text-muted-foreground" />
                                Audience
                            </h3>
                            <p className="text-sm text-muted-foreground tabular-nums">
                                <span className="text-2xl font-semibold text-foreground">
                                    {connected
                                        ? numberFormat.format(viewers)
                                        : '–'}
                                </span>{' '}
                                of {numberFormat.format(room.max_participants)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {live
                                    ? 'Leaving the studio keeps the session live. End it to disconnect everyone.'
                                    : 'People who join now wait for you. Your camera and mic go out when you go live.'}
                            </p>
                        </section>

                        <section className="space-y-2 rounded-xl border p-4">
                            <h3 className="flex items-center gap-2 text-sm font-medium">
                                <Link2 className="size-4 text-muted-foreground" />
                                Share links
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Viewers join through the room’s share links.
                            </p>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={edit(room.uuid)}>Manage links</Link>
                            </Button>
                        </section>

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
    roomUuid,
    room,
    status,
    unreachable,
    disconnectReason,
    onReconnect,
}: {
    roomUuid: string;
    room: LiveKitRoom;
    status: RoomConnectionStatus;
    unreachable: boolean;
    disconnectReason: DisconnectReason | undefined;
    onReconnect: () => void;
}) {
    if (status !== 'interrupted') {
        return null;
    }

    // The SDK is healing a blip on its own; a second join now would abort it.
    if (room.state !== ConnectionState.Disconnected && !unreachable) {
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
                    <Button variant="outline" size="sm" asChild>
                        <Link href={edit(roomUuid)}>Back to the room</Link>
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

Studio.layout = (props: { room: Room }) => ({
    breadcrumbs: [
        { title: 'Rooms', href: index() },
        { title: props.room.title, href: edit(props.room.uuid) },
        { title: 'Studio', href: studio(props.room.uuid) },
    ],
});
