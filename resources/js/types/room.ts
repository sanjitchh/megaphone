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
    host?: {
        uuid: string;
        name: string;
    };
    can: {
        edit_schedule: boolean;
        delete: boolean;
    };
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
