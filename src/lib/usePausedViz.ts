import { useCallback, useEffect, useRef, useState } from 'react';
import { createVizLoop, type VizFrame, type VizLoopOptions } from './vizLoop';

export interface PausedVizController {
  /** Is the rAF loop actively drawing right now (false while paused or halted by a hidden tab)? */
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Reset elapsed to 0 and play from the start. */
  restart: () => void;
}

export interface UsePausedVizOptions extends VizLoopOptions {
  /** Begin playing on mount. Default false — the mandatory no-autoplay default: a page must never
   *  burn CPU unattended. Opt in only for a view the user explicitly expects to move on arrival. */
  autoStart?: boolean;
}

/**
 * Drive a requestAnimationFrame loop under the no-compute-bomb rule: default paused,
 * run-once-then-stop (looping opt-in), and auto-halt whenever the tab is hidden. Every animated
 * canvas / 3D view in a Faena app should mount through this instead of calling rAF directly.
 *
 * `frame(dt, elapsed)` runs each frame (dt = ms since the previous frame, elapsed = ms since the
 * current pass began, excluding hidden time). Return `false` to end the pass; return `true` or
 * nothing to continue. With `loop`, a completed pass restarts; otherwise the loop pauses and
 * `onComplete` fires. Set `durationMs` for a finite animation with a guaranteed stop.
 */
export function usePausedViz(frame: VizFrame, options: UsePausedVizOptions = {}): PausedVizController {
  const { autoStart = false, loop, durationMs, onComplete } = options;

  const [playing, setPlaying] = useState(false);
  // keep the latest callbacks without rebuilding the loop each render.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const loopRef = useRef<ReturnType<typeof createVizLoop> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;

    const vloop = createVizLoop(
      (dt, elapsed) => frameRef.current(dt, elapsed),
      {
        loop,
        durationMs,
        onComplete: () => completeRef.current?.(),
        onPlayingChange: setPlaying,
      },
      { raf: requestAnimationFrame, caf: cancelAnimationFrame },
    );
    loopRef.current = vloop;

    const onVisibility = () => vloop.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    if (autoStart && !document.hidden) vloop.play();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      vloop.dispose();
      loopRef.current = null;
    };
    // built once per mount; option changes mid-life are rare and would reset the pass, so we pin them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(() => loopRef.current?.play(), []);
  const pause = useCallback(() => loopRef.current?.pause(), []);
  const toggle = useCallback(() => loopRef.current?.toggle(), []);
  const restart = useCallback(() => loopRef.current?.restart(), []);

  return { playing, play, pause, toggle, restart };
}
