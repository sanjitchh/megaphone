import { RoomEvent, Track } from 'livekit-client';
import type {
    ConnectionState,
    Participant,
    RemoteAudioTrack,
    RemoteParticipant,
    RemoteTrackPublication,
    RemoteVideoTrack,
    Room,
} from 'livekit-client';
import { useSyncExternalStore } from 'react';

// Everything that changes who is in the room or what they publish.
const ROOM_EVENTS = [
    RoomEvent.ConnectionStateChanged,
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.ParticipantPermissionsChanged,
    RoomEvent.ParticipantMetadataChanged,
    RoomEvent.ParticipantNameChanged,
    RoomEvent.TrackPublished,
    RoomEvent.TrackUnpublished,
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.TrackMuted,
    RoomEvent.TrackUnmuted,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
] as const;

/** One other person in the room, as plain data read at a moment in time. */
export type RemotePerson = {
    identity: string;
    name: string;
    role: string | undefined;
    canPublish: boolean;
    joinedAt: number;
    /** Publishing anything at all; for the host, that means the broadcast is on. */
    publishing: boolean;
    /** Their camera, while it is subscribed and not muted. */
    camera: RemoteVideoTrack | undefined;
    microphoneOn: boolean;
    screenShare: RemoteVideoTrack | undefined;
    audio: RemoteAudioTrack[];
};

export type RoomSnapshot = {
    state: ConnectionState;
    remotes: RemotePerson[];
    /** Whether this browser may publish: the host, or a viewer brought on stage. */
    canPublish: boolean;
};

const snapshots = new WeakMap<Room, RoomSnapshot>();
const stale = new WeakSet<Room>();

/** The role the server put in a participant's token metadata. */
export function roleOf(participant: Participant): string | undefined {
    try {
        return (JSON.parse(participant.metadata ?? '{}') as { role?: string })
            .role;
    } catch {
        return undefined;
    }
}

function videoOf(
    participant: RemoteParticipant,
    source: Track.Source,
): RemoteVideoTrack | undefined {
    const publication = participant.getTrackPublication(source) as
        | RemoteTrackPublication
        | undefined;

    return publication && !publication.isMuted
        ? (publication.videoTrack as RemoteVideoTrack | undefined)
        : undefined;
}

function personOf(participant: RemoteParticipant): RemotePerson {
    const microphone = participant.getTrackPublication(Track.Source.Microphone);

    return {
        identity: participant.identity,
        name: participant.name || 'Guest',
        role: roleOf(participant),
        canPublish: participant.permissions?.canPublish === true,
        joinedAt: participant.joinedAt?.getTime() ?? 0,
        publishing: participant.trackPublications.size > 0,
        camera: videoOf(participant, Track.Source.Camera),
        microphoneOn: microphone !== undefined && !microphone.isMuted,
        screenShare: videoOf(participant, Track.Source.ScreenShare),
        audio: [...participant.audioTrackPublications.values()]
            .map(
                (publication) =>
                    (publication as RemoteTrackPublication).audioTrack as
                        | RemoteAudioTrack
                        | undefined,
            )
            .filter((track) => track !== undefined),
    };
}

function read(room: Room): RoomSnapshot {
    return {
        state: room.state,
        remotes: [...room.remoteParticipants.values()].map(personOf),
        canPublish: room.localParticipant.permissions?.canPublish === true,
    };
}

/**
 * The room as plain data, replaced whenever its participants or tracks change. LiveKit's own
 * objects are mutated in place, which the React compiler cannot see, so components render
 * from this snapshot rather than reading the Room directly.
 */
export function useRoomSnapshot(room: Room): RoomSnapshot {
    return useSyncExternalStore(
        (onStoreChange) => {
            const handleChange = () => {
                stale.add(room);
                onStoreChange();
            };

            for (const event of ROOM_EVENTS) {
                room.on(event, handleChange);
            }

            return () => {
                for (const event of ROOM_EVENTS) {
                    room.off(event, handleChange);
                }
            };
        },
        () => {
            let snapshot = snapshots.get(room);

            if (!snapshot || stale.has(room)) {
                snapshot = read(room);
                snapshots.set(room, snapshot);
                stale.delete(room);
            }

            return snapshot;
        },
    );
}

export type Stage = {
    host: RemotePerson | undefined;
    screenShare: RemoteVideoTrack | undefined;
    speakers: RemotePerson[];
};

/**
 * Who is on stage, as viewers see it (SPEC §4.4): the host, the active screen share, and
 * the students promoted to speak (the only other participants allowed to publish).
 */
export function stageOf(remotes: RemotePerson[]): Stage {
    const host = remotes.find((person) => person.role === 'host');
    const screenShare = remotes.find(
        (person) => person.screenShare,
    )?.screenShare;
    const speakers = remotes
        .filter((person) => person !== host && person.canPublish)
        .sort((a, b) => a.joinedAt - b.joinedAt);

    return { host, screenShare, speakers };
}

/**
 * Whether the browser lets the room play sound yet. Autoplay rules can block it until the
 * person clicks something, in which case `room.startAudio()` from that click unblocks it.
 */
export function useCanPlayAudio(room: Room): boolean {
    return useSyncExternalStore(
        (onStoreChange) => {
            room.on(RoomEvent.AudioPlaybackStatusChanged, onStoreChange);

            return () =>
                room.off(RoomEvent.AudioPlaybackStatusChanged, onStoreChange);
        },
        () => room.canPlaybackAudio,
    );
}
