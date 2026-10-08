import { Head } from '@inertiajs/react';

type Reason = 'expired' | 'ended' | 'cancelled';

type Props = {
    reason: Reason;
    title?: string;
};

const messages: Record<Reason, { title: string; description: string }> = {
    expired: {
        title: 'This link has expired',
        description: 'Ask whoever sent it to you for a new link.',
    },
    ended: {
        title: 'This webinar has ended',
        description: 'The session is over, so it can no longer be joined.',
    },
    cancelled: {
        title: 'This webinar was cancelled',
        description: 'The session will not take place.',
    },
};

export default function JoinUnavailable({ reason, title }: Props) {
    return (
        <>
            <Head title={messages[reason].title} />

            {title && <p className="text-center font-medium">{title}</p>}
        </>
    );
}

JoinUnavailable.layout = (props: Props) => messages[props.reason];
