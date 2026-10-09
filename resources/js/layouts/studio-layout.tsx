/**
 * The host's studio runs in a tab of its own with nothing but the room's controls: no sidebar,
 * no breadcrumbs, no links to other rooms that could end up on a shared screen.
 */
export default function StudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-svh flex-col bg-background">{children}</div>
    );
}
