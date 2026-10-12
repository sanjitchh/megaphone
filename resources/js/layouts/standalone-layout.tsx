/**
 * A full-window page with nothing around it: the host's studio (no sidebar or links to other
 * rooms that could end up on a shared screen) and the room a viewer watches.
 */
export default function StandaloneLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-svh flex-col bg-background">{children}</div>
    );
}
