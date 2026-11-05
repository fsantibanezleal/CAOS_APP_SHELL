export interface MotionStage { run: () => void; durationMs?: number; }
export interface MotionOptions { reducedMotion?: boolean; signal?: AbortSignal; onStage?: (index: number) => void; }

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Apply a sequence in reading order; reduced motion applies each state immediately. */
export async function runStagedTransition(stages: MotionStage[], options: MotionOptions = {}): Promise<void> {
  const reduced = options.reducedMotion ?? prefersReducedMotion();
  for (const [index, stage] of stages.entries()) {
    if (options.signal?.aborted) return;
    options.onStage?.(index);
    stage.run();
    if (!reduced && (stage.durationMs ?? 240) > 0) await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.min(stage.durationMs ?? 240, 1500));
      options.signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
}

export interface CameraPose { position: readonly [number, number, number]; target: readonly [number, number, number]; }
export interface CameraFrame { setPosition: (x: number, y: number, z: number) => void; lookAt: (x: number, y: number, z: number) => void; }
export interface CameraFlyOptions extends MotionOptions { durationMs?: number; onFrame?: (progress: number) => void; }

/** Eased, interruptible camera flight without binding the shell to a particular WebGL renderer. */
export function flyCamera(frame: CameraFrame, from: CameraPose, to: CameraPose, options: CameraFlyOptions = {}): Promise<void> {
  const duration = options.reducedMotion ?? prefersReducedMotion() ? 0 : Math.min(1500, Math.max(600, options.durationMs ?? 900));
  if (!duration) { frame.setPosition(...to.position); frame.lookAt(...to.target); options.onFrame?.(1); return Promise.resolve(); }
  return new Promise((resolve) => {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = (now: number) => {
      if (options.signal?.aborted) { resolve(); return; }
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = t * t * (3 - 2 * t);
      const mix = (a: number, b: number) => a + (b - a) * eased;
      frame.setPosition(...from.position.map((v, i) => mix(v, to.position[i]!)) as [number, number, number]);
      frame.lookAt(...from.target.map((v, i) => mix(v, to.target[i]!)) as [number, number, number]);
      options.onFrame?.(t);
      if (t < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}
