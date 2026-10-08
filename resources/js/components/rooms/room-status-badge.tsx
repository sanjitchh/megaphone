import { Badge } from '@/components/ui/badge';
import type { RoomStatus } from '@/types';

const labels: Record<RoomStatus, string> = {
    SCHEDULED: 'Scheduled',
    LIVE: 'Live',
    ENDED: 'Ended',
    CANCELLED: 'Cancelled',
};

const variants: Record<
    RoomStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    SCHEDULED: 'secondary',
    LIVE: 'destructive',
    ENDED: 'outline',
    CANCELLED: 'outline',
};

export default function RoomStatusBadge({ status }: { status: RoomStatus }) {
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
