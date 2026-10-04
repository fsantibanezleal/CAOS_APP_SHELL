import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

/** Where a value on screen was computed (ADR-0057 lanes, ADR-0069 §5). */
export type Lane = 'live' | 'replay' | 'offline';

const DEFAULT_LABELS: Record<Lane, { en: string; es: string }> = {
  live: { en: 'Live in your browser', es: 'En vivo en tu navegador' },
  replay: { en: 'Replay of the offline result', es: 'Reproduce el resultado offline' },
  offline: { en: 'Offline only', es: 'Solo offline' },
};

/** A badge that states honestly which lane produced what is shown: recomputed live, replayed from a committed
 * artifact, or available only offline (shown from the baked result with no live recompute). */
export function LaneBadge({ lane, label }: { lane: Lane; label?: BiText }) {
  const lang = useShellLang();
  return (
    <span className={`badge caos-lane caos-lane-${lane}`} data-lane={lane}>
      {pick(label ?? DEFAULT_LABELS[lane], lang)}
    </span>
  );
}
