export type Reaction = 'ouch' | 'laugh' | 'shake' | 'hello';
type Expression = Reaction | 'idle' | 'blink';

interface Shape {
  mouth: number[];
  eye: number;
  tilt: number;
  tongue: number;
}

const SHAPES: Record<Expression, Shape> = {
  idle: { mouth: [153, 150, 158, 194, 202, 194, 207, 150, 202, 194, 158, 194, 153, 150], eye: 1, tilt: 0, tongue: 0 },
  blink: { mouth: [153, 150, 158, 194, 202, 194, 207, 150, 202, 194, 158, 194, 153, 150], eye: 0.08, tilt: 0, tongue: 0 },
  ouch: { mouth: [159, 141, 146, 111, 190, 110, 202, 145, 234, 213, 173, 222, 159, 141], eye: 0.16, tilt: -9, tongue: 1 },
  laugh: { mouth: [136, 152, 165, 171, 195, 171, 224, 152, 218, 222, 142, 222, 136, 152], eye: 0.23, tilt: 0, tongue: 1 },
  shake: { mouth: [166, 159, 166, 136, 194, 136, 194, 159, 194, 190, 166, 190, 166, 159], eye: 1.35, tilt: 6, tongue: 0.4 },
  hello: { mouth: [131, 146, 162, 162, 198, 162, 229, 146, 221, 193, 139, 193, 131, 146], eye: 1, tilt: 0, tongue: 0.7 },
};

export function mouthPath(points: number[]): string {
  return `M${points[0]},${points[1]} C${points.slice(2, 8).join(' ')} C${points.slice(8).join(' ')} Z`;
}

export function interpolate(from: Shape, to: Shape, progress: number): Shape {
  const t = Math.max(0, Math.min(1, progress));
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    mouth: from.mouth.map((value, i) => mix(value, to.mouth[i]!)),
    eye: mix(from.eye, to.eye),
    tilt: mix(from.tilt, to.tilt),
    tongue: mix(from.tongue, to.tongue),
  };
}

export class Face {
  private shape = SHAPES.idle;
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private blinkTimer: ReturnType<typeof setTimeout> | undefined;
  private active = true;
  private lastTouch = -Infinity;
  private lastReaction = -Infinity;
  private current: Expression = 'idle';
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private mouth: SVGPathElement;
  private tongue: SVGEllipseElement;
  private eyes: SVGGElement[];
  private group: SVGGElement;

  constructor(
    private host: HTMLElement,
    private speak: (reaction: Reaction) => void,
    private announce: (message: string) => void,
  ) {
    host.innerHTML = `<svg viewBox="0 0 360 270" aria-hidden="true">
      <defs><clipPath id="mouth-clip"><path /></clipPath></defs>
      <g class="features">
        <g class="eye" transform="translate(78 115)"><circle r="10.5"/><path class="eyelid" d="M-15 -8 Q0 -2 15 -8 M-15 8 Q0 2 15 8"/></g>
        <g class="eye" transform="translate(282 115)"><circle r="10.5"/><path class="eyelid" d="M-15 -8 Q0 -2 15 -8 M-15 8 Q0 2 15 8"/></g>
        <path class="mouth" stroke-width="4" stroke-linejoin="round" />
        <g clip-path="url(#mouth-clip)"><ellipse class="tongue" cx="187" cy="199" rx="30" ry="15"/></g>
      </g>
    </svg>`;
    this.mouth = host.querySelector('.mouth')!;
    this.tongue = host.querySelector('.tongue')!;
    this.eyes = [...host.querySelectorAll<SVGGElement>('.eye')];
    this.group = host.querySelector('.features')!;
    this.paint();
    this.scheduleBlink();
  }

  get expression() { return this.current; }

  react(reaction: Reaction, side = 0, source: 'touch' | 'motion' = 'touch') {
    if (!this.active) return;
    const now = performance.now();
    if (source === 'motion' && now - this.lastTouch < 1400) return;
    if (reaction === 'laugh' && this.current === 'laugh' && now - this.lastReaction < 300) return;
    if (source === 'touch') this.lastTouch = now;
    this.lastReaction = now;
    this.current = reaction;
    clearTimeout(this.timer);
    clearTimeout(this.blinkTimer);
    this.host.dataset.expression = reaction;
    this.animate({ ...SHAPES[reaction], tilt: SHAPES[reaction].tilt + side * 4 }, this.reduced.matches ? 35 : 140);
    this.speak(reaction);
    this.announce({ ouch: 'Ouch!', laugh: 'That tickles!', shake: 'Whoa!', hello: 'Hello, friend!' }[reaction]);
    this.timer = setTimeout(() => {
      this.current = 'idle';
      this.host.dataset.expression = 'idle';
      this.animate(SHAPES.idle, this.reduced.matches ? 35 : 240);
      this.scheduleBlink();
    }, reaction === 'laugh' ? 850 : 650);
  }

  private animate(target: Shape, duration: number) {
    cancelAnimationFrame(this.frame);
    const from = this.shape;
    const start = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      this.shape = interpolate(from, target, 1 - (1 - progress) ** 3);
      this.paint();
      this.frame = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    this.frame = requestAnimationFrame(step);
  }

  private paint() {
    const path = mouthPath(this.shape.mouth);
    this.mouth.setAttribute('d', path);
    this.host.querySelector('#mouth-clip path')!.setAttribute('d', path);
    this.tongue.style.opacity = String(this.shape.tongue);
    this.group.setAttribute('transform', `rotate(${this.shape.tilt} 180 140)`);
    this.eyes.forEach((eye, index) => {
      eye.setAttribute('transform', `translate(${index ? 282 : 78} 115)`);
      const squeeze = this.current === 'ouch' || this.current === 'laugh';
      eye.querySelector('circle')!.setAttribute('transform', `scale(1 ${squeeze ? Math.max(0.65, this.shape.eye) : this.shape.eye})`);
      eye.querySelector<SVGPathElement>('.eyelid')!.style.opacity = this.shape.eye < 0.4 ? '1' : '0';
    });
  }

  private scheduleBlink() {
    clearTimeout(this.blinkTimer);
    if (!this.active || this.reduced.matches) return;
    this.blinkTimer = setTimeout(() => {
      this.animate(SHAPES.blink, 75);
      this.timer = setTimeout(() => {
        this.animate(SHAPES.idle, 110);
        this.scheduleBlink();
      }, 160);
    }, 2800 + Math.random() * 3800);
  }

  suspend() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    clearTimeout(this.blinkTimer);
    this.shape = SHAPES.idle;
    this.current = 'idle';
    this.host.dataset.expression = 'idle';
    this.paint();
  }

  resume() { if (!this.active) { this.active = true; this.scheduleBlink(); } }
}
