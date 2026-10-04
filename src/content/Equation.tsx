import katex from 'katex';
import type { ReactNode } from 'react';

/** A display equation rendered with KaTeX and its caption. ADR-0017 s2 requires every display equation to carry a
 * bilingual caption that defines its symbols; a missing one is reported on the console, which the gate fails on. */
export function Equation({ tex, caption }: { tex: string; caption?: ReactNode }) {
  if (caption === undefined || caption === null || caption === '') {
    console.error(`[caos-app-shell] Equation without a caption (ADR-0017 s2): ${tex.slice(0, 60)}`);
  }
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
  return (
    <div className="equation">
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {caption && <div className="equation-caption">{caption}</div>}
    </div>
  );
}

/** Inline math for use within a sentence. */
export function InlineMath({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: false, throwOnError: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
