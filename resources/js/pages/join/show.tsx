import { Form, Head } from '@inertiajs/react';
import { CalendarClock, UserRound, Volume2 } from 'lucide-react';
import { useState } from 'react';
import JoinController from '@/actions/App/Http/Controllers/JoinController';
import InputError from '@/components/input-error';
import RoomStatusBadge from '@/components/rooms/room-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatSchedule } from '@/lib/datetime';
import type { JoinableRoom } from '@/types';

type Props = {
    slug: string;
    room: JoinableRoom;
    returning: { name: string; email: string } | null;
};

export default function JoinRoom({ slug, room, returning }: Props) {
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

                <Form
                    {...JoinController.store.form(slug)}
                    className="flex flex-col gap-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="name">Your name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    autoFocus
                                    maxLength={80}
                                    autoComplete="name"
                                    defaultValue={returning?.name}
                                    placeholder="Shown to the host"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    defaultValue={returning?.email}
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <SpeakerCheck />

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={processing}
                            >
                                {processing && <Spinner />}
                                {returning ? 'Rejoin webinar' : 'Join webinar'}
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

/**
 * Plays a short chime so people can fix their sound before the host starts talking.
 */
function SpeakerCheck() {
    const [playing, setPlaying] = useState(false);

    const play = () => {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 1);
        oscillator.onended = () => {
            setPlaying(false);
            void context.close();
        };
        setPlaying(true);
    };

    return (
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
            <span className="text-muted-foreground">
                {playing ? 'Can you hear the tone?' : 'Check your speakers'}
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={playing}
                onClick={play}
            >
                <Volume2 />
                Play test sound
            </Button>
        </div>
    );
}

JoinRoom.layout = {
    title: "You're invited",
    description: 'You can join any time while your link is valid.',
};
