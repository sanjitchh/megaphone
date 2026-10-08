import type { LucideProps } from 'lucide-react';
import { Megaphone } from 'lucide-react';

/** Placeholder mark until Megaphone has its own logo (SPEC §8). */
export default function AppLogoIcon(props: LucideProps) {
    return <Megaphone aria-hidden {...props} />;
}
