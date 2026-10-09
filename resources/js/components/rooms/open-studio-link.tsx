import { ExternalLink } from 'lucide-react';
import { studio } from '@/routes/rooms';

/**
 * Opens a room's studio in a tab of its own, away from the dashboard. The tab is named
 * after the room, so a second click focuses it rather than opening another studio that
 * would knock the first off the air.
 */
export default function OpenStudioLink({
    roomUuid,
    children,
    ...props
}: Omit<React.ComponentProps<'a'>, 'href' | 'target' | 'rel'> & {
    roomUuid: string;
}) {
    return (
        <a
            href={studio.url(roomUuid)}
            target={`studio-${roomUuid}`}
            rel="opener"
            {...props}
        >
            {children}
            <ExternalLink />
            <span className="sr-only">(opens in a new tab)</span>
        </a>
    );
}
