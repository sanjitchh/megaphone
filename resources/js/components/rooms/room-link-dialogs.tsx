import { router, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import RoomLinkController from '@/actions/App/Http/Controllers/RoomLinkController';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { fromLocalInputValue, toLocalInputValue } from '@/lib/datetime';
import type { Room, RoomLink } from '@/types';

/** Earliest pickable expiry: the current minute, in local input format. */
const nowLocal = () => toLocalInputValue(new Date().toISOString());

export function CreateLinkDialog({
    room,
    children,
}: {
    room: Room;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    const form = useForm({
        label: '',
        // SPEC §4.1: links default to the room's scheduled end.
        expires_at: toLocalInputValue(room.ends_at),
    });

    form.transform((data) => ({
        ...data,
        expires_at: fromLocalInputValue(data.expires_at),
    }));

    const onOpenChange = (next: boolean) => {
        setOpen(next);

        if (!next) {
            form.reset();
            form.clearErrors();
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(RoomLinkController.store(room.uuid), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <form onSubmit={submit} className="space-y-6">
                    <div className="space-y-2">
                        <DialogTitle>New link</DialogTitle>
                        <DialogDescription>
                            Anyone with the link can join until it expires or
                            you revoke it.
                        </DialogDescription>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="link_label">
                            Label{' '}
                            <span className="font-normal text-muted-foreground">
                                (optional)
                            </span>
                        </Label>
                        <Input
                            id="link_label"
                            value={form.data.label}
                            onChange={(e) =>
                                form.setData('label', e.target.value)
                            }
                            maxLength={100}
                            placeholder="Newsletter, partners, …"
                            aria-invalid={!!form.errors.label}
                        />
                        <InputError message={form.errors.label} />
                    </div>

                    <ExpiryField
                        id="link_expires_at"
                        value={form.data.expires_at}
                        onChange={(value) => form.setData('expires_at', value)}
                        error={form.errors.expires_at}
                    />

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Create link
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function ChangeExpiryDialog({
    room,
    link,
    children,
}: {
    room: Room;
    link: RoomLink;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);

    const form = useForm({ expires_at: toLocalInputValue(link.expires_at) });

    form.transform((data) => ({
        expires_at: fromLocalInputValue(data.expires_at),
    }));

    const onOpenChange = (next: boolean) => {
        setOpen(next);

        if (next) {
            form.setDefaults({
                expires_at: toLocalInputValue(link.expires_at),
            });
            form.reset();
            form.clearErrors();
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(
            RoomLinkController.update({ room: room.uuid, link: link.uuid }),
            { preserveScroll: true, onSuccess: () => setOpen(false) },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <form onSubmit={submit} className="space-y-6">
                    <div className="space-y-2">
                        <DialogTitle>Change expiry</DialogTitle>
                        <DialogDescription>
                            The link keeps its address. An expired link works
                            again once its expiry is in the future.
                        </DialogDescription>
                    </div>

                    <ExpiryField
                        id={`expires_at_${link.uuid}`}
                        value={form.data.expires_at}
                        onChange={(value) => form.setData('expires_at', value)}
                        error={form.errors.expires_at}
                    />

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Save expiry
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Confirmation for the one-click link actions (revoke, regenerate). */
export function ConfirmLinkActionDialog({
    action,
    title,
    description,
    confirmLabel,
    destructive = false,
    children,
}: {
    action: { url: string; method: 'post' };
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const [processing, setProcessing] = useState(false);

    const confirm = () => {
        router.visit(action, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={processing}
                        onClick={confirm}
                    >
                        {processing && <Spinner />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ExpiryField({
    id,
    value,
    onChange,
    error,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>Expires</Label>
            <Input
                id={id}
                type="datetime-local"
                value={value}
                min={nowLocal()}
                onChange={(e) => onChange(e.target.value)}
                required
                className="tabular-nums"
                aria-describedby={`${id}_hint`}
                aria-invalid={!!error}
            />
            <p id={`${id}_hint`} className="text-sm text-muted-foreground">
                In your time zone (
                {Intl.DateTimeFormat().resolvedOptions().timeZone}).
            </p>
            <InputError message={error} />
        </div>
    );
}
