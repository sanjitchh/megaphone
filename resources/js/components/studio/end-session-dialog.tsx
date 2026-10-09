import { router } from '@inertiajs/react';
import { useState } from 'react';
import RoomStudioController from '@/actions/App/Http/Controllers/RoomStudioController';
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

export default function EndSessionDialog({
    room,
    onEnding,
}: {
    room: Room;
    onEnding: (ending: boolean) => void;
}) {
    const [processing, setProcessing] = useState(false);

    const end = () => {
        router.visit(RoomStudioController.end(room.uuid), {
            onStart: () => {
                setProcessing(true);
                onEnding(true);
            },
            onFinish: () => {
                setProcessing(false);
                onEnding(false);
            },
        });
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="destructive">End session</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>End the session for everyone?</DialogTitle>
                <DialogDescription>
                    Every viewer is disconnected and the room’s links stop
                    letting anyone in. The room cannot go live again.
                </DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Keep broadcasting</Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        disabled={processing}
                        onClick={end}
                    >
                        {processing && <Spinner />}
                        End session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
