export type RoomStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type Room = {
    uuid: string;
    title: string;
    description: string | null;
    status: RoomStatus;
    max_participants: number;
    max_speakers: number;
    starts_at: string;
    ends_at: string;
    started_at: string | null;
    ended_at: string | null;
    host?: {
        uuid: string;
        name: string;
    };
    can: {
        edit_schedule: boolean;
        delete: boolean;
        create_links: boolean;
        open_studio: boolean;
        go_live: boolean;
        end: boolean;
    };
};

/** Someone in the room's hand queue or on its stage. */
export type StageParticipant = {
    uuid: string;
    name: string;
    hand_raised_at: string | null;
    promoted_at: string | null;
};

export type StageState = {
    hands: StageParticipant[];
    speakers: StageParticipant[];
};

/** A LiveKit grant for the host's studio; null when the media server could not be reached. */
export type StudioConnection = {
    server_url: string;
    token: string;
};

export type RoomLinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type RoomLink = {
    uuid: string;
    label: string | null;
    url: string;
    status: RoomLinkStatus;
    expires_at: string;
    revoked_at: string | null;
    created_at: string | null;
    can: {
        change_expiry: boolean;
        revoke: boolean;
        regenerate: boolean;
    };
};

export type JoinableRoom = {
    title: string;
    description: string | null;
    status: RoomStatus;
    starts_at: string;
    ends_at: string;
    host: string;
};

export type RoomFormOptions = {
    capacities: number[];
    default_max_speakers: number;
    max_speakers_limit: number;
};

export type Paginated<T> = {
    data: T[];
    links: {
        first: string | null;
        last: string | null;
        prev: string | null;
        next: string | null;
    };
    meta: {
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
};
