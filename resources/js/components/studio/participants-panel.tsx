import { router } from '@inertiajs/react';
import { Hand, Mic, MoreHorizontal, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import RoomParticipantController from '@/actions/App/Http/Controllers/RoomParticipantController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import type { RemotePerson } from '@/lib/livekit/use-stage';
import type { Room, StageParticipant, StageState } from '@/types';

const numberFormat = new Intl.NumberFormat();
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

type Action = 'promote' | 'demote' | 'lowerHand' | 'remove';

type Target = { uuid: string; name: string };

/**
 * The host's view of the audience (SPEC §4.5): raised hands longest-waiting first, who is
 * on stage, and everyone connected, with promote, demote, lower hand and remove.
 *
 * Presence comes from LiveKit (who is connected right now); hands and the stage come from
 * the server, which the studio reloads whenever it hears they changed.
 */
export default function ParticipantsPanel({
    room,
    remotes,
    connected,
    stage,
}: {
    room: Room;
    remotes: RemotePerson[];
    connected: boolean;
    stage: StageState;
}) {
    const [pending, setPending] = useState<string>();
    const [removing, setRemoving] = useState<Target>();
    const [filter, setFilter] = useState('');

    const live = room.status === 'LIVE';
    const stageFull = stage.speakers.length >= room.max_speakers;
    const audience = remotes
        .filter((person) => person.role !== 'host')
        .map((person) => ({ uuid: person.identity, name: person.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const present = new Set(audience.map((participant) => participant.uuid));
    const hands = new Set(stage.hands.map((participant) => participant.uuid));
    const speakers = new Set(
        stage.speakers.map((participant) => participant.uuid),
    );
    const query = filter.trim().toLowerCase();
    const shown = query
        ? audience.filter((participant) =>
              participant.name.toLowerCase().includes(query),
          )
        : audience;

    const act = (action: Action, target: Target, onDone?: () => void) => {
        router.visit(
            RoomParticipantController[action]({
                room: room.uuid,
                participant: target.uuid,
            }),
            {
                only: ['stage'],
                preserveState: true,
                preserveScroll: true,
                onStart: () => setPending(target.uuid),
                onFinish: () => {
                    setPending(undefined);
                    onDone?.();
                },
            },
        );
    };

    const promoteBlocked = (uuid: string) =>
        !live
            ? 'Bring people on stage once you are live.'
            : stageFull
              ? `The stage is full (${room.max_speakers}).`
              : !present.has(uuid)
                ? 'They have left the room.'
                : undefined;

    return (
        <div className="space-y-4">
            {stage.hands.length > 0 && (
                <section className="space-y-2 rounded-xl border border-amber-500/40 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                        <Hand className="size-4 text-amber-500" />
                        Raised hands
                        <Badge variant="secondary" className="tabular-nums">
                            {stage.hands.length}
                        </Badge>
                    </h3>
                    <ol className="space-y-1">
                        {stage.hands.map((participant) => (
                            <HandRow
                                key={participant.uuid}
                                participant={participant}
                                busy={pending === participant.uuid}
                                promoteBlocked={promoteBlocked(
                                    participant.uuid,
                                )}
                                onPromote={() => act('promote', participant)}
                                onLower={() => act('lowerHand', participant)}
                            />
                        ))}
                    </ol>
                </section>
            )}

            <section className="space-y-2 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Mic className="size-4 text-muted-foreground" />
                    On stage
                    <span className="text-muted-foreground tabular-nums">
                        {stage.speakers.length} of {room.max_speakers}
                    </span>
                </h3>
                {stage.speakers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Bring someone up from a raised hand or the audience
                        list.
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {stage.speakers.map((participant) => (
                            <li
                                key={participant.uuid}
                                className="flex items-center justify-between gap-2"
                            >
                                <span className="min-w-0 truncate text-sm">
                                    {participant.name}
                                    {!present.has(participant.uuid) && (
                                        <span className="text-muted-foreground">
                                            {' '}
                                            (away)
                                        </span>
                                    )}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pending === participant.uuid}
                                    onClick={() => act('demote', participant)}
                                >
                                    Move off stage
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="space-y-3 rounded-xl border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4 text-muted-foreground" />
                    Audience
                    <span className="text-muted-foreground tabular-nums">
                        {connected
                            ? numberFormat.format(audience.length)
                            : '–'}{' '}
                        of {numberFormat.format(room.max_participants)}
                    </span>
                </h3>

                {audience.length > 8 && (
                    <Input
                        type="search"
                        placeholder="Find someone"
                        aria-label="Find someone in the audience"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                    />
                )}

                {audience.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {live
                            ? 'Nobody has joined yet.'
                            : 'Nobody has joined yet. People who join before you go live wait for you.'}
                    </p>
                ) : (
                    <ul className="-mx-2 max-h-80 overflow-y-auto">
                        {shown.map((participant) => (
                            <li
                                key={participant.uuid}
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/50"
                            >
                                <span className="flex min-w-0 items-center gap-1.5 text-sm">
                                    <span className="truncate">
                                        {participant.name}
                                    </span>
                                    {hands.has(participant.uuid) && (
                                        <Hand
                                            className="size-3.5 shrink-0 text-amber-500"
                                            aria-label="Hand raised"
                                        />
                                    )}
                                    {speakers.has(participant.uuid) && (
                                        <Mic
                                            className="size-3.5 shrink-0 text-emerald-500"
                                            aria-label="On stage"
                                        />
                                    )}
                                </span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            disabled={
                                                pending === participant.uuid
                                            }
                                            aria-label={`Actions for ${participant.name}`}
                                        >
                                            {pending === participant.uuid ? (
                                                <Spinner />
                                            ) : (
                                                <MoreHorizontal />
                                            )}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {speakers.has(participant.uuid) ? (
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    act('demote', participant)
                                                }
                                            >
                                                Move off stage
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem
                                                disabled={
                                                    promoteBlocked(
                                                        participant.uuid,
                                                    ) !== undefined
                                                }
                                                onSelect={() =>
                                                    act('promote', participant)
                                                }
                                            >
                                                Bring on stage
                                            </DropdownMenuItem>
                                        )}
                                        {hands.has(participant.uuid) && (
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    act(
                                                        'lowerHand',
                                                        participant,
                                                    )
                                                }
                                            >
                                                Lower hand
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onSelect={() =>
                                                setRemoving(participant)
                                            }
                                        >
                                            <UserMinus />
                                            Remove…
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <Dialog
                open={removing !== undefined}
                onOpenChange={(open) => !open && setRemoving(undefined)}
            >
                <DialogContent>
                    <DialogTitle>Remove {removing?.name}?</DialogTitle>
                    <DialogDescription>
                        They are disconnected straight away and cannot rejoin
                        this webinar with the same email.
                    </DialogDescription>
                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            disabled={pending !== undefined}
                            onClick={() =>
                                removing &&
                                act('remove', removing, () =>
                                    setRemoving(undefined),
                                )
                            }
                        >
                            {pending !== undefined && <Spinner />}
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function HandRow({
    participant,
    busy,
    promoteBlocked,
    onPromote,
    onLower,
}: {
    participant: StageParticipant;
    busy: boolean;
    promoteBlocked: string | undefined;
    onPromote: () => void;
    onLower: () => void;
}) {
    return (
        <li className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                    {participant.name}
                </span>
                {participant.hand_raised_at && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {timeFormat.format(
                            new Date(participant.hand_raised_at),
                        )}
                    </span>
                )}
            </div>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    className="h-7"
                    disabled={busy || promoteBlocked !== undefined}
                    title={promoteBlocked}
                    onClick={onPromote}
                >
                    Bring on stage
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    disabled={busy}
                    onClick={onLower}
                >
                    Lower hand
                </Button>
            </div>
            {promoteBlocked && (
                <p className="text-xs text-muted-foreground">
                    {promoteBlocked}
                </p>
            )}
        </li>
    );
}
