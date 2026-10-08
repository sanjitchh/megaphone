import { Head } from '@inertiajs/react';
import RoomController from '@/actions/App/Http/Controllers/RoomController';
import Heading from '@/components/heading';
import RoomForm from '@/components/rooms/room-form';
import { create, index } from '@/routes/rooms';
import type { RoomFormOptions } from '@/types';

export default function CreateRoom({ options }: { options: RoomFormOptions }) {
    return (
        <>
            <Head title="New room" />

            <div className="mx-auto w-full max-w-2xl px-4 py-6">
                <Heading
                    title="New room"
                    description="Schedule a webinar. You'll be its host."
                />

                <RoomForm
                    options={options}
                    action={RoomController.store()}
                    submitLabel="Create room"
                />
            </div>
        </>
    );
}

CreateRoom.layout = {
    breadcrumbs: [
        { title: 'Rooms', href: index() },
        { title: 'New room', href: create() },
    ],
};
