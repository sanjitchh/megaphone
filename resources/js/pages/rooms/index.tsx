import { Head, Link } from '@inertiajs/react';
import { Plus, Radio, Video } from 'lucide-react';
import Heading from '@/components/heading';
import OpenStudioLink from '@/components/rooms/open-studio-link';
import RoomStatusBadge from '@/components/rooms/room-status-badge';
import { Button } from '@/components/ui/button';
import { formatSchedule } from '@/lib/datetime';
import { create, edit, index } from '@/routes/rooms';
import type { Paginated, Room } from '@/types';

const numberFormat = new Intl.NumberFormat();

export default function Rooms({ rooms }: { rooms: Paginated<Room> }) {
    return (
        <>
            <Head title="Rooms" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4">
                <div className="flex items-start justify-between gap-4">
                    <Heading
                        title="Rooms"
                        description="Your scheduled, live and past webinars."
                    />
                    <Button asChild>
                        <Link href={create()}>
                            <Plus />
                            New room
                        </Link>
                    </Button>
                </div>

                {rooms.data.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium"
                                    >
                                        Title
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium"
                                    >
                                        Status
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium"
                                    >
                                        Schedule
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 text-right font-medium"
                                    >
                                        Capacity
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rooms.data.map((room) => (
                                    <tr
                                        key={room.uuid}
                                        className="transition-colors hover:bg-muted/50"
                                    >
                                        <td className="px-4 py-3">
                                            <Link
                                                href={edit(room.uuid)}
                                                className="font-medium text-foreground underline-offset-4 hover:underline"
                                            >
                                                {room.title}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">
                                            <RoomStatusBadge
                                                status={room.status}
                                            />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                                            {formatSchedule(
                                                room.starts_at,
                                                room.ends_at,
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                                            {numberFormat.format(
                                                room.max_participants,
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            {room.can.open_studio && (
                                                <Button
                                                    variant={
                                                        room.status === 'LIVE'
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    size="sm"
                                                    asChild
                                                >
                                                    <OpenStudioLink
                                                        roomUuid={room.uuid}
                                                        aria-label={`Open the studio for ${room.title} in a new tab`}
                                                    >
                                                        <Radio />
                                                        Studio
                                                    </OpenStudioLink>
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {rooms.meta.last_page > 1 && (
                    <nav
                        aria-label="Pagination"
                        className="flex items-center justify-between text-sm text-muted-foreground tabular-nums"
                    >
                        <span>
                            {rooms.meta.from}–{rooms.meta.to} of{' '}
                            {rooms.meta.total}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!rooms.links.prev}
                                asChild={!!rooms.links.prev}
                            >
                                {rooms.links.prev ? (
                                    <Link href={rooms.links.prev}>
                                        Previous
                                    </Link>
                                ) : (
                                    'Previous'
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!rooms.links.next}
                                asChild={!!rooms.links.next}
                            >
                                {rooms.links.next ? (
                                    <Link href={rooms.links.next}>Next</Link>
                                ) : (
                                    'Next'
                                )}
                            </Button>
                        </div>
                    </nav>
                )}
            </div>
        </>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-sidebar-border/70 p-12 text-center dark:border-sidebar-border">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Video className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <h3 className="font-medium">No rooms yet</h3>
                <p className="text-sm text-muted-foreground">
                    Create a room to schedule your first webinar.
                </p>
            </div>
            <Button asChild>
                <Link href={create()}>
                    <Plus />
                    New room
                </Link>
            </Button>
        </div>
    );
}

Rooms.layout = {
    breadcrumbs: [{ title: 'Rooms', href: index() }],
};
