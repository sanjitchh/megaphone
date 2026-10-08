import { Check, Clock, Copy, Link2, Plus, RefreshCw, Ban } from 'lucide-react';
import RoomLinkController from '@/actions/App/Http/Controllers/RoomLinkController';
import Heading from '@/components/heading';
import {
    ChangeExpiryDialog,
    ConfirmLinkActionDialog,
    CreateLinkDialog,
} from '@/components/rooms/room-link-dialogs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClipboard } from '@/hooks/use-clipboard';
import { formatDateTime } from '@/lib/datetime';
import type { Room, RoomLink, RoomLinkStatus } from '@/types';

const statusLabels: Record<RoomLinkStatus, string> = {
    ACTIVE: 'Active',
    EXPIRED: 'Expired',
    REVOKED: 'Revoked',
};

export default function RoomLinks({
    room,
    links,
}: {
    room: Room;
    links: RoomLink[];
}) {
    const [copiedText, copy] = useClipboard();

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <Heading
                    variant="small"
                    title="Share links"
                    description={
                        room.can.create_links
                            ? 'Anyone with an active link can join. Links default to expiring when the room is scheduled to end.'
                            : 'This room has finished, so its links no longer let anyone in.'
                    }
                />
                {room.can.create_links && (
                    <CreateLinkDialog room={room}>
                        <Button variant="outline" size="sm">
                            <Plus />
                            New link
                        </Button>
                    </CreateLinkDialog>
                )}
            </div>

            {links.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
                    <Link2 className="size-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        No links yet. Create one to invite people.
                    </p>
                </div>
            ) : (
                <ul className="divide-y rounded-xl border">
                    {links.map((link) => (
                        <li
                            key={link.uuid}
                            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">
                                        {link.label ?? 'Untitled link'}
                                    </span>
                                    <Badge
                                        variant={
                                            link.status === 'ACTIVE'
                                                ? 'secondary'
                                                : 'outline'
                                        }
                                    >
                                        {statusLabels[link.status]}
                                    </Badge>
                                </div>
                                <p
                                    className={
                                        link.status === 'ACTIVE'
                                            ? 'truncate font-mono text-xs'
                                            : 'truncate font-mono text-xs text-muted-foreground line-through'
                                    }
                                >
                                    {link.url}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                    {link.revoked_at
                                        ? `Revoked ${formatDateTime(link.revoked_at)}`
                                        : link.status === 'EXPIRED'
                                          ? `Expired ${formatDateTime(link.expires_at)}`
                                          : `Expires ${formatDateTime(link.expires_at)}`}
                                </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                                {link.status === 'ACTIVE' && (
                                    <IconAction
                                        label={
                                            copiedText === link.url
                                                ? 'Copied'
                                                : 'Copy link'
                                        }
                                        onClick={() => void copy(link.url)}
                                    >
                                        {copiedText === link.url ? (
                                            <Check />
                                        ) : (
                                            <Copy />
                                        )}
                                    </IconAction>
                                )}

                                {link.can.change_expiry && (
                                    <ChangeExpiryDialog room={room} link={link}>
                                        <IconAction label="Change expiry">
                                            <Clock />
                                        </IconAction>
                                    </ChangeExpiryDialog>
                                )}

                                {link.can.regenerate && (
                                    <ConfirmLinkActionDialog
                                        action={RoomLinkController.regenerate({
                                            room: room.uuid,
                                            link: link.uuid,
                                        })}
                                        title="Regenerate this link?"
                                        description="You get a new address with the same label and expiry. The current address stops working straight away."
                                        confirmLabel="Regenerate"
                                    >
                                        <IconAction label="Regenerate">
                                            <RefreshCw />
                                        </IconAction>
                                    </ConfirmLinkActionDialog>
                                )}

                                {link.can.revoke && (
                                    <ConfirmLinkActionDialog
                                        action={RoomLinkController.revoke({
                                            room: room.uuid,
                                            link: link.uuid,
                                        })}
                                        title="Revoke this link?"
                                        description="People opening it will see that the link has expired. A revoked link cannot be turned back on."
                                        confirmLabel="Revoke link"
                                        destructive
                                    >
                                        <IconAction label="Revoke">
                                            <Ban />
                                        </IconAction>
                                    </ConfirmLinkActionDialog>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * Icon-only button with a tooltip and an accessible name. Spreads the props a
 * Radix `asChild` trigger passes down, so it can sit inside a DialogTrigger.
 */
function IconAction({
    label,
    children,
    ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    {...props}
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
