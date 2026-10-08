import { router } from '@inertiajs/react';
import { useState } from 'react';
import RoomController from '@/actions/App/Http/Controllers/RoomController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { Room } from '@/types';

export default function DeleteRoom({ room }: { room: Room }) {
    const [processing, setProcessing] = useState(false);

    const destroy = () => {
        router.visit(RoomController.destroy(room.uuid), {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <div className="space-y-6">
            <Heading
                variant="small"
                title="Delete room"
                description={
                    room.can.delete
                        ? 'Remove this room and stop all of its links from working.'
                        : 'A live room has to be ended before it can be deleted.'
                }
            />

            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="destructive" disabled={!room.can.delete}>
                        Delete room
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogTitle>Delete “{room.title}”?</DialogTitle>
                    <DialogDescription>
                        Its links will stop working. This cannot be undone from
                        the dashboard.
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            disabled={processing}
                            onClick={destroy}
                        >
                            {processing && <Spinner />}
                            Delete room
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
