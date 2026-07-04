// Framework-free animation-loop core enforcing the portfolio no-compute-bomb rule (ADR-0059 /
// the "no autoplay, no compute bomb" feedback): a viz must default PAUSED, run once then STOP
// (looping is opt-in), and HALT whenever its tab is hidden so an unattended page never spins the
// CPU. This module holds the state machine with every side-effecting dependency injected
// (requestAnimationFrame / cancelAnimationFrame / a clock), so it is unit-testable with a fake
// clock and no DOM. `usePausedViz` is the thin React wrapper around it.

/** Return `false` from a frame to end the current pass (the animation is complete); return `true`
 *  or nothing to keep going. `dt` = ms since the previous frame, `elapsed` = ms since this pass
 *  began (never counts time while the tab was hidden). */
export type VizFrame = (dt: number, elapsed: number) => boolean | void;

export interface VizLoopOptions {
  /** Repeat after each completed pass instead of stopping. Default false (run once, then stop). */
  loop?: boolean;
  /** Auto-complete the pass once `elapsed` reaches this many ms (a hard cap so a frame that never
   *  returns false still stops). The final frame is drawn clamped to exactly this value. */
  durationMs?: number;
  /** Fired once each time the loop stops on its own (a completed pass with loop=false) — not on a
   *  manual pause and not on a visibility halt. */
  onComplete?: () => void;
  /** Notified whenever the running state changes, so a React wrapper can mirror it into state. */
  onPlayingChange?: (playing: boolean) => void;
}

/** Injected side effects — real ones in the hook, fakes in tests. The frame timestamp comes from
 *  the rAF callback argument, so no separate clock is needed. */
export interface VizLoopDeps {
  raf: (cb: (now: number) => void) => number;
  caf: (handle: number) => void;
}

export interface VizLoop {
  /** Is the loop actively requesting frames right now? (false while paused OR halted by hidden tab). */
  isPlaying: () => boolean;
  /** Does the user WANT motion? (stays true across a visibility halt; false once paused/completed). */
  isRunning: () => boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Reset elapsed to 0 and play from the start. */
  restart: () => void;
  /** Feed a document-visibility change: hidden halts the rAF (keeping intent), visible resumes it. */
  setHidden: (hidden: boolean) => void;
  /** Cancel any pending frame and detach (idempotent). */
  dispose: () => void;
}

export function createVizLoop(frame: VizFrame, options: VizLoopOptions, deps: VizLoopDeps): VizLoop {
  const { loop = false, durationMs, onComplete, onPlayingChange } = options;
  const { raf, caf } = deps;

  let handle: number | null = null; // pending rAF id, or null when not requesting frames
  let want = false; // the user's intent to animate (survives a hidden-tab halt)
  let hidden = false;
  let last = 0; // timestamp of the previous frame
  let baseline = true; // take the next frame as a fresh dt baseline (dt 0) — set on play/resume/loop
  let elapsed = 0; // accumulated ms for the current pass (excludes hidden time)

  const playing = () => handle !== null;
  const emitPlaying = (was: boolean) => {
    if (was !== playing()) onPlayingChange?.(playing());
  };

  const request = () => {
    if (handle === null) handle = raf(tick);
  };
  const cancel = () => {
    if (handle !== null) {
      caf(handle);
      handle = null;
    }
  };

  function tick(t: number): void {
    handle = null; // consumed; tick decides whether to request the next
    if (baseline) {
      last = t; // first frame of this run segment: no dt jump
      baseline = false;
    }
    const dt = t - last;
    last = t;
    elapsed += dt;

    let e = elapsed;
    const capped = durationMs != null && e >= durationMs;
    if (capped) e = durationMs;

    const cont = frame(dt, e);

    if (capped || cont === false) {
      if (loop) {
        elapsed = 0;
        baseline = true;
        request();
      } else {
        const was = true;
        want = false;
        // handle already null
        emitPlaying(was);
        onComplete?.();
      }
      return;
    }
    request();
  }

  const play = () => {
    if (want && playing()) return;
    const was = playing();
    want = true;
    baseline = true; // fresh dt baseline; elapsed continues from where it paused
    if (!hidden) request();
    emitPlaying(was);
  };

  const pause = () => {
    const was = playing();
    want = false;
    cancel();
    emitPlaying(was);
  };

  const restart = () => {
    const was = playing();
    want = true;
    elapsed = 0;
    baseline = true;
    cancel();
    if (!hidden) request();
    emitPlaying(was);
  };

  const setHidden = (h: boolean) => {
    if (h === hidden) return;
    hidden = h;
    const was = playing();
    if (hidden) {
      cancel(); // freeze, keep `want`
    } else if (want) {
      baseline = true; // don't count the hidden gap as dt
      request();
    }
    emitPlaying(was);
  };

  return {
    isPlaying: playing,
    isRunning: () => want,
    play,
    pause,
    toggle: () => (want ? pause() : play()),
    restart,
    setHidden,
    dispose: () => {
      want = false;
      cancel();
    },
  };
}
