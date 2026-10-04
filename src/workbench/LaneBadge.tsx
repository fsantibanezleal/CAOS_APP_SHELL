import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import type { Provenance } from './state';

/** Where a value on screen was computed (ADR-0057 lanes, ADR-0069 s5). */
export type Lane = 'live' | 'replay' | 'offline';

const LANE_LABELS: Record<Lane, { en: string; es: string }> = {
  live: { en: 'Live in your browser', es: 'En vivo en tu navegador' },
  replay: { en: 'Replay of the offline result', es: 'Reproduce el resultado offline' },
  offline: { en: 'Offline only', es: 'Solo offline' },
};

const PROVENANCE_LABELS: Record<Provenance, { en: string; es: string }> = {
  real: { en: 'Real data', es: 'Datos reales' },
  synthetic: { en: 'Synthetic data', es: 'Datos sintéticos' },
  published: { en: 'Published reference', es: 'Referencia publicada' },
};

/** Badges that state honestly which lane produced what is shown (recomputed live, replayed from a committed
 * artifact, or available only offline) and, when given, whether it rests on real, synthetic or published data
 * (failure class 17 of the 2026-10-04 history: live versus replay honesty). */
export function LaneBadge({ lane, provenance, label }: { lane: Lane; provenance?: Provenance; label?: BiText }) {
  const lang = useShellLang();
  return (
    <span className="caos-badges">
      <span className={`badge caos-lane caos-lane-${lane}`} data-lane={lane}>
        {pick(label ?? LANE_LABELS[lane], lang)}
      </span>
      {provenance && (
        <span className={`badge caos-prov caos-prov-${provenance}`} data-provenance={provenance}>
          {pick(PROVENANCE_LABELS[provenance], lang)}
        </span>
      )}
    </span>
  );
}
