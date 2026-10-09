import type { LocalTrack } from 'livekit-client';
import { ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMediaDevices, useTrackMuted } from '@/lib/livekit/use-local-media';

/**
 * A mute toggle for the camera or mic, with a menu to pick which device it uses.
 * Switching device keeps the track (and its publication), so viewers see no gap.
 */
export default function DeviceControl({
    track,
    kind,
    label,
    icon: Icon,
    mutedIcon: MutedIcon,
}: {
    track: LocalTrack | undefined;
    kind: MediaDeviceKind;
    label: string;
    icon: LucideIcon;
    mutedIcon: LucideIcon;
}) {
    const muted = useTrackMuted(track);
    const devices = useMediaDevices(kind, track);
    // The track opens after the first render, so until a device is picked, read it off the track.
    const [picked, setPicked] = useState<string>();
    const deviceId =
        picked ?? track?.mediaStreamTrack.getSettings().deviceId ?? '';
    const [busy, setBusy] = useState(false);

    const toggle = async () => {
        if (!track) {
            return;
        }

        setBusy(true);

        try {
            await (muted ? track.unmute() : track.mute());
        } catch {
            toast.error(`Your ${label.toLowerCase()} could not be turned on.`);
        } finally {
            setBusy(false);
        }
    };

    const switchDevice = async (id: string) => {
        if (!track) {
            return;
        }

        const previous = picked;

        setPicked(id);

        if (!(await track.setDeviceId(id))) {
            setPicked(previous);
            toast.error(`That ${label.toLowerCase()} could not be used.`);
        }
    };

    const action = muted
        ? `Turn on ${label.toLowerCase()}`
        : `Turn off ${label.toLowerCase()}`;

    return (
        <div className="flex">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={muted ? 'destructive' : 'secondary'}
                        size="icon"
                        className="rounded-r-none"
                        disabled={!track || busy}
                        aria-pressed={!muted}
                        aria-label={action}
                        onClick={toggle}
                    >
                        {muted ? <MutedIcon /> : <Icon />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {track ? action : `No ${label.toLowerCase()}`}
                </TooltipContent>
            </Tooltip>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant={muted ? 'destructive' : 'secondary'}
                        size="icon"
                        className="w-6 rounded-l-none border-l border-background/40"
                        disabled={!track || devices.length === 0}
                        aria-label={`Choose ${label.toLowerCase()}`}
                    >
                        <ChevronUp />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-72">
                    <DropdownMenuLabel>{label}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        value={deviceId}
                        onValueChange={switchDevice}
                    >
                        {devices.map((device) => (
                            <DropdownMenuRadioItem
                                key={device.deviceId}
                                value={device.deviceId}
                            >
                                <span className="truncate">
                                    {device.label ||
                                        `${label} ${device.deviceId.slice(0, 6)}`}
                                </span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
