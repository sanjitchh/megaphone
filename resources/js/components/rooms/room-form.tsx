import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    addMinutesToLocalInputValue,
    fromLocalInputValue,
    toLocalInputValue,
} from '@/lib/datetime';
import type { Room, RoomFormOptions } from '@/types';

type RoomFormData = {
    title: string;
    description: string;
    max_participants: number;
    max_speakers: number;
    starts_at: string;
    ends_at: string;
};

type RouteDefinition = {
    url: string;
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
};

const numberFormat = new Intl.NumberFormat();

export default function RoomForm({
    room,
    options,
    action,
    submitLabel,
}: {
    room?: Room;
    options: RoomFormOptions;
    action: RouteDefinition;
    submitLabel: string;
}) {
    const schedulingEditable = room?.can.edit_schedule ?? true;

    const form = useForm<RoomFormData>({
        title: room?.title ?? '',
        description: room?.description ?? '',
        max_participants: room?.max_participants ?? options.capacities[0],
        max_speakers: room?.max_speakers ?? options.default_max_speakers,
        starts_at: room ? toLocalInputValue(room.starts_at) : '',
        ends_at: room ? toLocalInputValue(room.ends_at) : '',
    });

    form.transform((data) => {
        if (!schedulingEditable) {
            return { title: data.title, description: data.description };
        }

        return {
            ...data,
            starts_at: fromLocalInputValue(data.starts_at),
            ends_at: fromLocalInputValue(data.ends_at),
        };
    });

    const onStartsAtChange = (value: string) => {
        form.setData((data) => ({
            ...data,
            starts_at: value,
            // Default a fresh room to an hour long; leave a chosen end time alone.
            ends_at:
                data.ends_at === '' && value !== ''
                    ? addMinutesToLocalInputValue(value, 60)
                    : data.ends_at,
        }));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(action, { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                    id="title"
                    value={form.data.title}
                    onChange={(e) => form.setData('title', e.target.value)}
                    required
                    maxLength={255}
                    autoFocus={!room}
                    placeholder="Quarterly all-hands"
                    aria-invalid={!!form.errors.title}
                />
                <InputError message={form.errors.title} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="description">
                    Description{' '}
                    <span className="font-normal text-muted-foreground">
                        (optional)
                    </span>
                </Label>
                <textarea
                    id="description"
                    value={form.data.description}
                    onChange={(e) =>
                        form.setData('description', e.target.value)
                    }
                    maxLength={5000}
                    rows={4}
                    aria-invalid={!!form.errors.description}
                    className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40"
                />
                <InputError message={form.errors.description} />
            </div>

            <fieldset disabled={!schedulingEditable} className="space-y-6">
                {!schedulingEditable && (
                    <p className="text-sm text-muted-foreground">
                        The schedule and capacity can only be changed while the
                        room is scheduled.
                    </p>
                )}

                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="starts_at">Starts</Label>
                        <Input
                            id="starts_at"
                            type="datetime-local"
                            value={form.data.starts_at}
                            onChange={(e) => onStartsAtChange(e.target.value)}
                            required
                            className="tabular-nums"
                            aria-invalid={!!form.errors.starts_at}
                        />
                        <InputError message={form.errors.starts_at} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="ends_at">Ends</Label>
                        <Input
                            id="ends_at"
                            type="datetime-local"
                            value={form.data.ends_at}
                            min={form.data.starts_at || undefined}
                            onChange={(e) =>
                                form.setData('ends_at', e.target.value)
                            }
                            required
                            className="tabular-nums"
                            aria-invalid={!!form.errors.ends_at}
                        />
                        <InputError message={form.errors.ends_at} />
                    </div>
                </div>
                <p className="-mt-4 text-sm text-muted-foreground">
                    Times are in your time zone (
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}). The
                    schedule is informational: people can join any time while
                    their link is valid.
                </p>

                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="max_participants">Capacity</Label>
                        <Select
                            value={String(form.data.max_participants)}
                            onValueChange={(value) =>
                                form.setData('max_participants', Number(value))
                            }
                            disabled={!schedulingEditable}
                        >
                            <SelectTrigger
                                id="max_participants"
                                className="w-full tabular-nums"
                                aria-invalid={!!form.errors.max_participants}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {options.capacities.map((capacity) => (
                                    <SelectItem
                                        key={capacity}
                                        value={String(capacity)}
                                        className="tabular-nums"
                                    >
                                        Up to {numberFormat.format(capacity)}{' '}
                                        participants
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.max_participants} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="max_speakers">Stage limit</Label>
                        <Input
                            id="max_speakers"
                            type="number"
                            min={0}
                            max={options.max_speakers_limit}
                            value={form.data.max_speakers}
                            onChange={(e) =>
                                form.setData(
                                    'max_speakers',
                                    e.target.valueAsNumber,
                                )
                            }
                            required
                            className="tabular-nums"
                            aria-describedby="max_speakers_hint"
                            aria-invalid={!!form.errors.max_speakers}
                        />
                        <p
                            id="max_speakers_hint"
                            className="text-sm text-muted-foreground"
                        >
                            Students who can be promoted to speak at the same
                            time (0–{options.max_speakers_limit}).
                        </p>
                        <InputError message={form.errors.max_speakers} />
                    </div>
                </div>
            </fieldset>

            <div className="flex items-center gap-4">
                <Button type="submit" disabled={form.processing}>
                    {form.processing && <Spinner />}
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}
