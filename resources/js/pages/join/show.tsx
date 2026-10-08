import { Head } from '@inertiajs/react';
import { CalendarClock, UserRound } from 'lucide-react';
import RoomStatusBadge from '@/components/rooms/room-status-badge';
import { Button } from '@/components/ui/button';
import { formatSchedule } from '@/lib/datetime';
import type { JoinableRoom } from '@/types';

export default function JoinRoom({ room }: { room: JoinableRoom }) {
    return (
        <>
            <Head title={room.title} />

            <div className="space-y-6">
                <div className="space-y-3 rounded-xl border p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="font-medium">{room.title}</h2>
                        <RoomStatusBadge status={room.status} />
                    </div>
                    {room.description && (
                        <p className="whitespace-pre-line text-muted-foreground">
                            {room.description}
                        </p>
                    )}
                    <dl className="space-y-2 text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <dt>
                                <CalendarClock className="size-4" />
                                <span className="sr-only">Scheduled</span>
                            </dt>
                            <dd className="tabular-nums">
                                {formatSchedule(room.starts_at, room.ends_at)}
                            </dd>
                        </div>
                        <div className="flex items-center gap-2">
                            <dt>
                                <UserRound className="size-4" />
                                <span className="sr-only">Host</span>
                            </dt>
                            <dd>{room.host}</dd>
                        </div>
                    </dl>
                </div>

                {/* The pre-join form (name, email, speaker check) comes with guest joining. */}
                <Button className="w-full" disabled>
                    Join webinar
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                    Joining is not available yet.
                </p>
            </div>
        </>
    );
}

JoinRoom.layout = {
    title: "You're invited",
    description: 'You can join any time while your link is valid.',
};
