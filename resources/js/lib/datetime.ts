/**
 * `<input type="datetime-local">` works in the browser's local time with no
 * offset; the server stores UTC. These helpers convert between the two.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO timestamp → `YYYY-MM-DDTHH:mm` in the browser's time zone. */
export function toLocalInputValue(iso: string): string {
    const date = new Date(iso);

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DDTHH:mm` (local) → ISO timestamp in UTC; empty stays empty for validation. */
export function fromLocalInputValue(value: string): string {
    return value === '' ? '' : new Date(value).toISOString();
}

/** Adds minutes to a local input value, keeping the local format. */
export function addMinutesToLocalInputValue(
    value: string,
    minutes: number,
): string {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() + minutes);

    return toLocalInputValue(date.toISOString());
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

/** "7 Oct 2026, 14:00 – 15:00", or both full dates when the range spans days. */
export function formatSchedule(startsAt: string, endsAt: string): string {
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    return start.toDateString() === end.toDateString()
        ? `${dateTimeFormat.format(start)} – ${timeFormat.format(end)}`
        : `${dateTimeFormat.format(start)} – ${dateTimeFormat.format(end)}`;
}
