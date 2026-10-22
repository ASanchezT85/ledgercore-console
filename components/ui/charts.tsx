// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

// Brand charts (7.13): debit blue above the axis, credit amber below it.
// Plain SVG on the theme tokens, so they follow light and dark mode.

/** Rounds up to 1, 2, 2.5 or 5 × 10ⁿ so axis ticks land on round values. */
function niceCeil(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

export interface MirrorPoint {
  label: string;
  up: number;
  down: number;
}

/**
 * Mirrored bars around a center axis: `up` in debit blue, `down` in credit
 * amber. One scale for both halves so the two sides compare honestly.
 */
export function MirrorBars({
  points,
  upLabel,
  downLabel,
  format = (n) => String(n),
}: {
  points: MirrorPoint[];
  upLabel: string;
  downLabel: string;
  format?: (n: number) => string;
}) {
  const W = 640;
  const H = 200;
  const left = 44;
  const right = 8;
  const top = 8;
  const bottom = 22;
  const half = (H - top - bottom) / 2;
  const mid = top + half;
  const max = niceCeil(Math.max(1, ...points.map((p) => Math.max(p.up, p.down))));
  const step = (W - left - right) / Math.max(1, points.length);
  const bw = Math.min(18, step * 0.6);
  const s = (v: number) => (v / max) * (half - 2);
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="lc-bars block h-auto w-full"
        role="img"
        aria-label={`${upLabel} and ${downLabel} over ${points.length} periods`}
      >
        {[1, 0.5].map((f) => (
          <g key={f}>
            <line x1={left} x2={W - right} y1={mid - s(max * f)} y2={mid - s(max * f)} stroke="var(--color-edge)" />
            <line x1={left} x2={W - right} y1={mid + s(max * f)} y2={mid + s(max * f)} stroke="var(--color-edge)" />
            <text x={left - 6} y={mid - s(max * f) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)" className="num">
              {format(max * f)}
            </text>
            <text x={left - 6} y={mid + s(max * f) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)" className="num">
              {format(max * f)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const x = left + step * i + (step - bw) / 2;
          return (
            <g key={p.label} style={{ animationDelay: `${i * 30}ms` }}>
              <title>{`${p.label}: ${upLabel} ${format(p.up)} · ${downLabel} ${format(p.down)}`}</title>
              <rect x={x} y={mid - s(p.up)} width={bw} height={s(p.up)} rx="3" fill="var(--color-debit)" />
              <rect className="dn" x={x} y={mid + 1} width={bw} height={s(p.down)} rx="3" fill="var(--color-credit)" />
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={left} x2={W - right} y1={mid} y2={mid} stroke="var(--color-ink)" strokeWidth="1.2" />
      </svg>
      <figcaption className="mt-2 flex gap-4 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-debit" aria-hidden="true" />
          {upLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-credit" aria-hidden="true" />
          {downLabel}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Debits vs credits for one asset as a two-tone beam: equal halves when the
 * ledger balances, a visibly tilted split when it does not.
 */
export function BalanceBeam({ debits, credits }: { debits: bigint; credits: bigint }) {
  const total = debits + credits;
  const pct = total === BigInt(0) ? 50 : Number((debits * BigInt(1000)) / total) / 10;
  return (
    <div
      className="lc-beam flex h-2 overflow-hidden rounded-full"
      role="img"
      aria-label={`Debits ${pct.toFixed(1)}% · credits ${(100 - pct).toFixed(1)}%`}
    >
      <span className="h-full bg-debit" style={{ width: `${pct}%` }} />
      <span className="h-full w-0.5 bg-surface" />
      <span className="h-full flex-1 bg-credit" />
    </div>
  );
}
