import { Head } from '@inertiajs/react';
import RoomController from '@/actions/App/Http/Controllers/RoomController';
import Heading from '@/components/heading';
import DeleteRoom from '@/components/rooms/delete-room';
import RoomForm from '@/components/rooms/room-form';
import RoomStatusBadge from '@/components/rooms/room-status-badge';
import { Separator } from '@/components/ui/separator';
import { edit, index } from '@/routes/rooms';
import type { Room, RoomFormOptions } from '@/types';

export default function EditRoom({
    room,
    options,
}: {
    room: Room;
    options: RoomFormOptions;
}) {
    return (
        <>
            <Head title={room.title} />

            <div className="mx-auto w-full max-w-2xl space-y-10 px-4 py-6">
                <div>
                    <div className="flex items-start justify-between gap-4">
                        <Heading
                            title={room.title}
                            description={
                                room.host
                                    ? `Hosted by ${room.host.name}`
                                    : undefined
                            }
                        />
                        <RoomStatusBadge status={room.status} />
                    </div>

                    <RoomForm
                        key={room.uuid}
                        room={room}
                        options={options}
                        action={RoomController.update(room.uuid)}
                        submitLabel="Save"
                    />
                </div>

                <Separator />

                <DeleteRoom room={room} />
            </div>
        </>
    );
}

EditRoom.layout = (props: { room: Room }) => ({
    breadcrumbs: [
        { title: 'Rooms', href: index() },
        { title: props.room.title, href: edit(props.room.uuid) },
    ],
});
