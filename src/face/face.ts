import { tappedEye, type EyeCenter, type EyeSide } from './hit-test';

export type Reaction = 'ouch' | 'laugh' | 'shake' | 'hello' | 'love' | 'wink' | 'dizzy';
type Expression = Reaction | 'idle' | 'blink' | 'yawn' | 'grimace' | 'delighted' | 'content' | 'frown' | 'happy';

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
  love: { mouth: [139, 148, 166, 162, 194, 162, 221, 148, 215, 199, 145, 199, 139, 148], eye: 1, tilt: 0, tongue: 0.7 },
  wink: { mouth: [159, 141, 146, 111, 190, 110, 202, 145, 234, 213, 173, 222, 159, 141], eye: 1, tilt: 0, tongue: 1 },
  dizzy: { mouth: [132, 130, 131, 76, 222, 76, 224, 130, 201, 168, 177, 66, 154, 138], eye: 1.65, tilt: -8, tongue: 0 },
  yawn: { mouth: [132, 164, 151, 110, 209, 110, 228, 164, 221, 187, 139, 187, 132, 164], eye: 0, tilt: 0, tongue: 0 },
  grimace: { mouth: [124, 148, 147, 161, 213, 161, 236, 148, 247, 158, 247, 180, 236, 190, 213, 177, 147, 177, 124, 190, 113, 180, 113, 158, 124, 148], eye: 0.6, tilt: 0, tongue: 0 },
  delighted: { mouth: [141, 146, 157, 131, 203, 131, 219, 146, 217, 220, 143, 220, 141, 146], eye: 1, tilt: 0, tongue: 1 },
  content: { mouth: [130, 153, 159, 164, 201, 164, 230, 153, 201, 164, 159, 164, 130, 153], eye: 1, tilt: 0, tongue: 0 },
  frown: { mouth: [153, 157, 164, 149, 196, 149, 207, 157, 196, 149, 164, 149, 153, 157], eye: 1, tilt: 0, tongue: 0 },
  happy: { mouth: [145, 149, 151, 196, 209, 196, 215, 149, 209, 196, 151, 196, 145, 149], eye: 0, tilt: 0, tongue: 0 },
};

// Four matching cubic segments allow the narrow grimace and rounded mouths to morph.
for (const shape of Object.values(SHAPES)) {
  if (shape.mouth.length !== 14) continue;
  const points = shape.mouth;
  const expanded = points.slice(0, 2);
  let start = points.slice(0, 2);
  const midpoint = (a: number[], b: number[]) => a.map((value, i) => (value + b[i]!) / 2);
  for (let i = 2; i < points.length; i += 6) {
    const first = points.slice(i, i + 2);
    const second = points.slice(i + 2, i + 4);
    const end = points.slice(i + 4, i + 6);
    const a = midpoint(start, first);
    const b = midpoint(first, second);
    const c = midpoint(second, end);
    const d = midpoint(a, b);
    const e = midpoint(b, c);
    expanded.push(...a, ...d, ...midpoint(d, e), ...e, ...c, ...end);
    start = end;
  }
  shape.mouth = expanded;
}

const FOLLOW_UP: Partial<Record<Reaction, Expression>> = {
  laugh: 'delighted', hello: 'content', dizzy: 'frown', love: 'happy',
};

export function mouthPath(points: number[]): string {
  let path = `M${points[0]},${points[1]}`;
  for (let i = 2; i < points.length; i += 6) path += ` C${points.slice(i, i + 6).join(' ')}`;
  return `${path} Z`;
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
  private lastActivity = performance.now();
  private blinkAt = this.lastActivity + this.blinkDelay();
  private yawnAt = this.lastActivity + 30000;
  private lastShake = -Infinity;
  private lastPoke = -Infinity;
  private pokeCount = 0;
  private eyeSide: EyeSide = -1;
  private active = true;
  private lastTouch = -Infinity;
  private lastReaction = -Infinity;
  private current: Expression = 'idle';
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private mouth: SVGPathElement;
  private tongue: SVGEllipseElement;
  private eyes: SVGGElement[];
  private group: SVGGElement;
  private bubble: HTMLParagraphElement;

  constructor(
    private host: HTMLElement,
    private speak: (reaction: Reaction) => void,
    private announce: (message: string) => void,
  ) {
    host.innerHTML = `<svg viewBox="0 0 360 270" aria-hidden="true">
      <defs><clipPath id="mouth-clip"><path /></clipPath></defs>
      <g class="features">
        <g class="eye" transform="translate(78 115)"><circle r="10.5"/><path class="eyelid" d="M-15 -8 Q0 -2 15 -8 M-15 8 Q0 2 15 8"/><path class="heart-eye" d="M0 17 C-33 -4 -14 -29 0 -13 C14 -29 33 -4 0 17 Z"/></g>
        <g class="eye" transform="translate(282 115)"><circle r="10.5"/><path class="eyelid" d="M-15 -8 Q0 -2 15 -8 M-15 8 Q0 2 15 8"/><path class="heart-eye" d="M0 17 C-33 -4 -14 -29 0 -13 C14 -29 33 -4 0 17 Z"/></g>
        <path class="mouth" stroke-width="4" stroke-linejoin="round" />
        <g clip-path="url(#mouth-clip)"><ellipse class="tongue" cx="187" cy="199" rx="30" ry="15"/>
          <path class="teeth" d="M121 145 Q180 176 239 145 L239 163 Q180 185 121 163 Z M135 197 Q180 174 225 197 L225 214 L135 214 Z"/>
        </g>
        <g class="cheeks"><path d="M57 115 l8 -5 -4 10 10 -7 -3 10 10 -7 M261 115 l8 -5 -4 10 10 -7 -3 10 10 -7"/></g>
      </g>
    </svg>
    <p class="speech-bubble" aria-hidden="true" hidden>I love you Azalea</p>`;
    this.mouth = host.querySelector('.mouth')!;
    this.tongue = host.querySelector('.tongue')!;
    this.eyes = [...host.querySelectorAll<SVGGElement>('.eye')];
    this.group = host.querySelector('.features')!;
    this.bubble = host.querySelector('.speech-bubble')!;
    this.host.dataset.expression = 'idle';
    this.paint();
    this.scheduleBlink();
  }

  get expression() { return this.current; }

  private blinkDelay() { return 5000 + Math.random() * 5000; }

  activity() {
    if (!this.active) return;
    this.lastActivity = performance.now();
    this.blinkAt = this.lastActivity + this.blinkDelay();
    this.yawnAt = this.lastActivity + 30000;
    if (this.current === 'idle') this.scheduleBlink();
  }

  poke(x: number, y: number, side = 0) {
    const centers: EyeCenter[] = this.eyes.flatMap((eye, index) => {
      const matrix = eye.getScreenCTM();
      return matrix ? [{ x: matrix.e, y: matrix.f, side: index === 0 ? -1 : 1 }] : [];
    });
    const eye = tappedEye(x, y, centers);
    this.react(eye === undefined ? 'ouch' : 'wink', eye ?? side);
  }

  react(reaction: Reaction, side = 0, source: 'touch' | 'motion' = 'touch') {
    if (!this.active) return;
    const now = performance.now();
    if (source === 'motion' && now - this.lastTouch < 1400) return;
    if (reaction === 'laugh' && this.current === 'laugh' && now - this.lastReaction < 300) return;
    this.activity();
    if (source === 'touch') this.lastTouch = now;
    if (reaction === 'shake') {
      if (now - this.lastShake <= 5000) reaction = 'dizzy';
      this.lastShake = now;
    }
    if (reaction === 'ouch') {
      this.pokeCount = now - this.lastPoke <= 900 ? this.pokeCount + 1 : 1;
      this.lastPoke = now;
    } else {
      this.pokeCount = 0;
    }
    if (reaction === 'wink') this.eyeSide = side > 0 ? 1 : -1;
    this.lastReaction = now;
    this.current = reaction;
    clearTimeout(this.timer);
    clearTimeout(this.blinkTimer);
    this.host.dataset.expression = reaction;
    this.bubble.hidden = reaction !== 'love';
    this.animate({ ...SHAPES[reaction], tilt: SHAPES[reaction].tilt + side * 4 }, this.reduced.matches ? 35 : 140);
    this.speak(reaction);
    this.announce({ ouch: 'Ouch!', laugh: 'That tickles!', shake: 'Whoa!', hello: 'Hello, friend!', love: 'I love you Azalea', wink: 'Ouch, my eye!', dizzy: 'Feeling dizzy!' }[reaction]);
    const followUp = reaction === 'ouch' && this.pokeCount >= 3 ? 'grimace' : FOLLOW_UP[reaction];
    this.timer = setTimeout(() => {
      this.bubble.hidden = true;
      if (followUp) {
        this.showExpression(followUp, 180);
        this.timer = setTimeout(() => this.recover(), 800);
      } else {
        this.recover();
      }
    }, reaction === 'love' ? 3000 : reaction === 'laugh' ? 850 : reaction === 'dizzy' ? 1400 : 650);
  }

  private showExpression(expression: Expression, duration: number) {
    this.current = expression;
    this.host.dataset.expression = expression;
    this.animate(SHAPES[expression], this.reduced.matches ? 35 : duration);
  }

  private recover() {
    this.showExpression('idle', 240);
    this.scheduleBlink();
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
    const teeth = this.host.querySelector('.teeth')!;
    teeth.setAttribute('d', this.current === 'grimace'
      ? 'M110 140 H250 V200 H110 Z M110 169 Q180 166 250 169'
      : this.current === 'dizzy'
        ? 'M140 80 H220 V98 H140 Z'
        : 'M121 126 Q180 124 239 126 L239 151 Q180 145 121 151 Z M135 197 Q180 174 225 197 L225 214 L135 214 Z');
    this.group.setAttribute('transform', `rotate(${this.shape.tilt} 180 140)`);
    this.eyes.forEach((eye, index) => {
      const isWink = this.current === 'wink' && (index === 0 ? -1 : 1) === this.eyeSide;
      const curved = this.current === 'yawn' || this.current === 'happy';
      const y = this.current === 'dizzy' ? 75 : 115;
      eye.setAttribute('transform', `translate(${index ? 282 : 78} ${y})`);
      const squeeze = isWink || this.current === 'ouch' || this.current === 'laugh' || this.current === 'grimace';
      const closed = curved || this.current === 'blink';
      const circle = eye.querySelector('circle')!;
      circle.setAttribute('transform', `scale(1 ${closed ? this.shape.eye : squeeze ? 0.65 : this.shape.eye})`);
      circle.setAttribute('opacity', isWink || curved ? '0' : '1');
      eye.dataset.closed = String(isWink || closed);
      const eyelid = eye.querySelector<SVGPathElement>('.eyelid')!;
      eyelid.setAttribute('d', curved ? 'M-15 0 Q0 -13 15 0' : isWink ? 'M-15 -6 Q0 -13 15 0 Q0 13 -15 6 M-19 -13 Q-5 -23 10 -15' : 'M-15 -8 Q0 -2 15 -8 M-15 8 Q0 2 15 8');
      eyelid.style.opacity = isWink || curved || squeeze || this.shape.eye < 0.4 ? '1' : '0';
    });
  }

  private scheduleBlink() {
    clearTimeout(this.blinkTimer);
    if (!this.active) return;
    const now = performance.now();
    const due = this.reduced.matches ? this.yawnAt : Math.min(this.blinkAt, this.yawnAt);
    this.blinkTimer = setTimeout(() => {
      if (performance.now() >= this.yawnAt) {
        this.yawnAt = performance.now() + 30000;
        this.blinkAt = performance.now() + this.blinkDelay();
        this.showExpression('yawn', 320);
        this.timer = setTimeout(() => this.recover(), 1800);
      } else {
        this.blinkAt = performance.now() + this.blinkDelay();
        this.showExpression('blink', 75);
        this.timer = setTimeout(() => this.recover(), 160);
      }
    }, Math.max(0, due - now));
  }

  suspend() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    clearTimeout(this.blinkTimer);
    this.shape = SHAPES.idle;
    this.current = 'idle';
    this.host.dataset.expression = 'idle';
    this.bubble.hidden = true;
    this.paint();
  }

  resume() {
    if (!this.active) {
      this.active = true;
      this.activity();
      this.scheduleBlink();
    }
  }
}
