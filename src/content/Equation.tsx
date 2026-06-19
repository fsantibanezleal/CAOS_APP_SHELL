import katex from 'katex';
import type { ReactNode } from 'react';

/** A display equation rendered with KaTeX, with an optional caption. */
export function Equation({ tex, caption }: { tex: string; caption?: ReactNode }) {
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
