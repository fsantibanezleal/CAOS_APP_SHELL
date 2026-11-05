import type { ReactNode } from 'react';

export interface Scene3DFrameProps {
  /** A concise accessible name for the authored 3D scene. */
  label: string;
  legendLabel?: string;
  /** The product-owned WebGL/canvas/SVG renderer and controls. The shared shell never invents geometry. */
  children: ReactNode;
  controls?: ReactNode;
  legend?: ReactNode;
  status?: ReactNode;
  className?: string;
}

/** Renderer-agnostic 3D composition frame: one full-size scene with separate controls, legend and availability. */
export function Scene3DFrame({ label, legendLabel = 'Scene legend', children, controls, legend, status, className }: Scene3DFrameProps) {
  return <section className={['caos-scene3d-frame', className].filter(Boolean).join(' ')} data-caos-scene3d-frame="">
    {controls && <div className="caos-scene3d-controls" data-caos-scene3d-controls="">{controls}</div>}
    <div className="caos-scene3d-viewport" role="region" aria-label={label} data-caos-scene3d-viewport="">
      <div className="caos-scene3d-renderer" data-caos-scene3d-renderer="">{children}</div>
      {status && <div className="caos-scene3d-status" role="status">{status}</div>}
      {legend && <aside className="caos-scene3d-legend" aria-label={legendLabel}>{legend}</aside>}
    </div>
  </section>;
}
