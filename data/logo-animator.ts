/**
 * logo-animator.ts
 * kib-git-quickview — animated dashboard-gauge ⇄ K-monogram logo.
 *
 * Drop this next to an inline SVG (see markup at bottom of this file)
 * whose elements carry matching `data-part` attributes:
 *   [data-part="rim"]          <circle>  — the wheel rim / bracket
 *   [data-part="needle"]       <line>    — the gauge needle / K's upper stroke
 *   [data-part="spoke-right"]  <line>    — lower-right spoke / K's lower stroke
 *   [data-part="spoke-left"]   <line>    — lower-left spoke, retracts away
 *   [data-part="dot"]          <circle>  — fixed pivot, does not move
 *
 * Usage:
 *   const svg = document.querySelector<SVGSVGElement>("#kib-logo")!;
 *   const logo = new LogoAnimator(svg);
 *   logo.toggle();                 // gauge -> monogram or back
 *   logo.setState("monogram");     // explicit
 *   button.addEventListener("click", () => logo.toggle());
 *
 * No external animation library required — driven by requestAnimationFrame
 * so it works identically in the popup and the side panel without pulling
 * in a dependency for a single component.
 */

export type LogoState = "gauge" | "monogram";

const CENTER = 100;
const RIM_RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RIM_RADIUS;
const DURATION_MS = 650;

interface Point {
  x: number;
  y: number;
}

interface StrokeFrame {
  x2: number;
  y2: number;
  opacity: number;
}

interface RimFrame {
  dash: number;
  gap: number;
  offset: number;
  rotate: number;
}

interface Frame {
  rim: RimFrame;
  needle: StrokeFrame;
  spokeRight: StrokeFrame;
  spokeLeft: StrokeFrame;
}

function pointOnRay(angleDeg: number, length: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + length * Math.cos(rad),
    y: CENTER + length * Math.sin(rad),
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// --- Tune these five rays/lengths to fine-tune the silhouette. ---
const needleGauge = pointOnRay(-55, 45);
const needleMonogram = pointOnRay(-35, 85);
const spokeRightGauge = pointOnRay(55, 60);
const spokeRightMonogram = pointOnRay(35, 85);
const spokeLeftGauge = pointOnRay(125, 60);

const STATES: Record<LogoState, Frame> = {
  gauge: {
    rim: { dash: CIRCUMFERENCE, gap: CIRCUMFERENCE, offset: 0, rotate: 0 },
    needle: { x2: needleGauge.x, y2: needleGauge.y, opacity: 1 },
    spokeRight: { x2: spokeRightGauge.x, y2: spokeRightGauge.y, opacity: 1 },
    spokeLeft: { x2: spokeLeftGauge.x, y2: spokeLeftGauge.y, opacity: 1 },
  },
  monogram: {
    rim: {
      dash: CIRCUMFERENCE * 0.3,
      gap: CIRCUMFERENCE * 0.7,
      offset: CIRCUMFERENCE * 0.35,
      rotate: 6,
    },
    needle: { x2: needleMonogram.x, y2: needleMonogram.y, opacity: 1 },
    spokeRight: { x2: spokeRightMonogram.x, y2: spokeRightMonogram.y, opacity: 1 },
    // retracts back into the dot rather than just fading — reinforces
    // that the dot is the one element that never moves.
    spokeLeft: { x2: CENTER, y2: CENTER, opacity: 0 },
  },
};

interface LogoParts {
  rim: SVGCircleElement;
  needle: SVGLineElement;
  spokeRight: SVGLineElement;
  spokeLeft: SVGLineElement;
}

export class LogoAnimator {
  private readonly parts: LogoParts;
  private current: LogoState = "gauge";
  private frame: number | null = null;

  constructor(svg: SVGSVGElement) {
    this.parts = this.resolveParts(svg);
    this.paint(STATES.gauge);
  }

  get state(): LogoState {
    return this.current;
  }

  toggle(): LogoState {
    return this.setState(this.current === "gauge" ? "monogram" : "gauge");
  }

  setState(next: LogoState): LogoState {
    if (next === this.current) return this.current;
    const from = STATES[this.current];
    const to = STATES[next];
    this.animate(from, to);
    this.current = next;
    return next;
  }

  destroy(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
  }

  private resolveParts(svg: SVGSVGElement): LogoParts {
    const q = <T extends Element>(part: string): T => {
      const el = svg.querySelector<T>(`[data-part="${part}"]`);
      if (!el) throw new Error(`LogoAnimator: missing [data-part="${part}"]`);
      return el;
    };
    return {
      rim: q<SVGCircleElement>("rim"),
      needle: q<SVGLineElement>("needle"),
      spokeRight: q<SVGLineElement>("spoke-right"),
      spokeLeft: q<SVGLineElement>("spoke-left"),
    };
  }

  private animate(from: Frame, to: Frame): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      this.paint(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const e = easeInOutCubic(t);
      this.paint(this.interpolate(from, to, e));
      this.frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private interpolate(from: Frame, to: Frame, t: number): Frame {
    const stroke = (a: StrokeFrame, b: StrokeFrame): StrokeFrame => ({
      x2: lerp(a.x2, b.x2, t),
      y2: lerp(a.y2, b.y2, t),
      opacity: lerp(a.opacity, b.opacity, t),
    });
    return {
      rim: {
        dash: lerp(from.rim.dash, to.rim.dash, t),
        gap: lerp(from.rim.gap, to.rim.gap, t),
        offset: lerp(from.rim.offset, to.rim.offset, t),
        rotate: lerp(from.rim.rotate, to.rim.rotate, t),
      },
      needle: stroke(from.needle, to.needle),
      spokeRight: stroke(from.spokeRight, to.spokeRight),
      spokeLeft: stroke(from.spokeLeft, to.spokeLeft),
    };
  }

  private paint(s: Frame): void {
    const { rim, needle, spokeRight, spokeLeft } = this.parts;

    rim.setAttribute("stroke-dasharray", `${s.rim.dash} ${s.rim.gap}`);
    rim.setAttribute("stroke-dashoffset", `${s.rim.offset}`);
    rim.style.transformOrigin = `${CENTER}px ${CENTER}px`;
    rim.style.transform = `rotate(${s.rim.rotate}deg)`;

    this.paintStroke(needle, s.needle);
    this.paintStroke(spokeRight, s.spokeRight);
    this.paintStroke(spokeLeft, s.spokeLeft);
  }

  private paintStroke(el: SVGLineElement, s: StrokeFrame): void {
    el.setAttribute("x2", `${s.x2}`);
    el.setAttribute("y2", `${s.y2}`);
    el.style.opacity = `${s.opacity}`;
  }
}

/**
 * Companion SVG markup — inline this in the popup/side-panel HTML,
 * or inject it as a component. `data-part` attributes are required;
 * `x1`/`y1` always stay at the center (100,100) pivot.
 *
 * <svg id="kib-logo" viewBox="0 0 200 200" width="32" height="32">
 *   <circle data-part="rim" cx="100" cy="100" r="70" fill="none"
 *     stroke="var(--charcoal-900)" stroke-width="14" stroke-linecap="round" />
 *   <line data-part="spoke-left" x1="100" y1="100" x2="100" y2="100"
 *     stroke="var(--charcoal-900)" stroke-width="14" stroke-linecap="round" />
 *   <line data-part="spoke-right" x1="100" y1="100" x2="100" y2="100"
 *     stroke="var(--charcoal-900)" stroke-width="14" stroke-linecap="round" />
 *   <line data-part="needle" x1="100" y1="100" x2="100" y2="100"
 *     stroke="var(--rust-terracotta-500)" stroke-width="14" stroke-linecap="round" />
 *   <circle data-part="dot" cx="100" cy="100" r="13" fill="var(--rust-terracotta-500)" />
 * </svg>
 */
