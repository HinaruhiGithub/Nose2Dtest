import { Bodies, Body, Composite, type Engine } from 'matter-js';
import { Container, Graphics } from 'pixi.js';
import { PARAMS } from '../config/params';
import type { CavePoint, CaveShape } from './CaveGenerator';

export const LABEL_FLOOR = 'cave-floor';
export const LABEL_CEILING = 'cave-ceiling';
export const LABEL_END_WALL = 'cave-end';

const WALL_THICKNESS = 28;

const COLORS = {
  fleshOuter: 0x8f4a55,
  fleshInner: 0xa85f6b,
  cavity: 0x2e161b,
  lining: 0xc98a92,
  highlight: 0xecc0c5,
};

export class NoseCave {
  readonly view = new Container();
  readonly shape: CaveShape;
  private readonly bodies: Body[] = [];
  private squishG = new Graphics();
  private floorOffsets: number[];
  private ceilingOffsets: number[];

  constructor(engine: Engine, shape: CaveShape) {
    this.shape = shape;
    this.floorOffsets = new Array(shape.floor.length).fill(0);
    this.ceilingOffsets = new Array(shape.ceiling.length).fill(0);
    this.buildBodies(engine);
    this.draw();
    this.view.addChild(this.squishG);
  }

  private segmentBody(a: CavePoint, b: CavePoint, outwardY: 1 | -1, label: string): Body {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    let nx = -dy / len;
    let ny = dx / len;
    if (Math.sign(ny) !== outwardY) {
      nx = -nx;
      ny = -ny;
    }
    const cx = (a.x + b.x) / 2 + nx * (WALL_THICKNESS / 2);
    const cy = (a.y + b.y) / 2 + ny * (WALL_THICKNESS / 2);
    return Bodies.rectangle(cx, cy, len + 6, WALL_THICKNESS, {
      isStatic: true,
      angle,
      label,
      restitution: PARAMS.cave.wallRestitution,
      friction: 0.9,
    });
  }

  private buildBodies(engine: Engine): void {
    const { floor, ceiling, length } = this.shape;
    for (let i = 0; i < floor.length - 1; i++) {
      this.bodies.push(this.segmentBody(floor[i], floor[i + 1], 1, LABEL_FLOOR));
      this.bodies.push(this.segmentBody(ceiling[i], ceiling[i + 1], -1, LABEL_CEILING));
    }
    const endCy = this.shape.centerYAt(length);
    const endR = this.shape.radiusAt(length);
    this.bodies.push(
      Bodies.rectangle(length + WALL_THICKNESS / 2, endCy, WALL_THICKNESS, endR * 2 + 80, {
        isStatic: true,
        label: LABEL_END_WALL,
        restitution: PARAMS.cave.wallRestitution,
        friction: 0.9,
      }),
    );
    Composite.add(engine.world, this.bodies);
  }

  private draw(): void {
    const g = new Graphics();
    const { floor, ceiling, length } = this.shape;

    const pad = 400;
    const thick = PARAMS.cave.fleshThickness;

    // 鼻腔に沿った肉の帯(外側に背景のヤギ顔が見える)
    const band = (offset: number, color: number) => {
      g.moveTo(-pad, ceiling[0].y - offset);
      for (const p of ceiling) g.lineTo(p.x, p.y - offset);
      g.lineTo(length + pad, ceiling[ceiling.length - 1].y - offset);
      g.lineTo(length + pad, floor[floor.length - 1].y + offset);
      for (let i = floor.length - 1; i >= 0; i--) g.lineTo(floor[i].x, floor[i].y + offset);
      g.lineTo(-pad, floor[0].y + offset);
      g.closePath();
      g.fill(color);
    };
    band(thick, COLORS.fleshOuter);
    band(thick * 0.55, COLORS.fleshInner);

    // 空洞部分(入り口は外に向かって開く)
    const entranceFlare = 90;
    g.moveTo(-pad, ceiling[0].y - entranceFlare);
    for (const p of ceiling) g.lineTo(p.x, p.y);
    for (let i = floor.length - 1; i >= 0; i--) g.lineTo(floor[i].x, floor[i].y);
    g.lineTo(-pad, floor[0].y + entranceFlare);
    g.closePath();
    g.fill(COLORS.cavity);

    // 内壁の粘膜ライン
    const stroke = (pts: CavePoint[], width: number, color: number, alpha: number) => {
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) g.lineTo(p.x, p.y);
      g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
    };
    stroke(floor, 10, COLORS.lining, 1);
    stroke(ceiling, 10, COLORS.lining, 1);
    stroke(floor, 3, COLORS.highlight, 0.5);
    stroke(ceiling, 3, COLORS.highlight, 0.35);

    this.view.addChild(g);
  }

  // プレイヤーの接触位置に合わせて壁の描画をへこませる(見た目のみ)
  updateSquish(px: number, py: number, dtSec: number): void {
    const squish = PARAMS.cave.wallSquishVisual;
    const reach = PARAMS.player.height * 1.3;
    const rate = Math.min(1, 14 * dtSec);
    const step = (pts: CavePoint[], offsets: number[]) => {
      let active = false;
      for (let i = 0; i < pts.length; i++) {
        const dist = Math.hypot(pts[i].x - px, pts[i].y - py);
        const press = Math.max(0, 1 - dist / reach);
        const target = squish * press * press;
        offsets[i] += (target - offsets[i]) * rate;
        if (offsets[i] > 0.05) active = true;
        else offsets[i] = 0;
      }
      return active;
    };
    const floorActive = step(this.shape.floor, this.floorOffsets);
    const ceilingActive = step(this.shape.ceiling, this.ceilingOffsets);

    this.squishG.clear();
    if (floorActive) this.drawSquish(this.shape.floor, this.floorOffsets, 1);
    if (ceilingActive) this.drawSquish(this.shape.ceiling, this.ceilingOffsets, -1);
  }

  private drawSquish(pts: CavePoint[], offsets: number[], dir: 1 | -1): void {
    let i0 = -1;
    let i1 = -1;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] > 0.05) {
        if (i0 < 0) i0 = i;
        i1 = i;
      }
    }
    if (i0 < 0) return;
    i0 = Math.max(0, i0 - 1);
    i1 = Math.min(pts.length - 1, i1 + 1);

    const g = this.squishG;
    // 元の粘膜ラインを空洞色で覆い、へこんだ位置に描き直す
    g.moveTo(pts[i0].x, pts[i0].y - dir * 8);
    for (let i = i0; i <= i1; i++) g.lineTo(pts[i].x, pts[i].y - dir * 8);
    for (let i = i1; i >= i0; i--) g.lineTo(pts[i].x, pts[i].y + dir * offsets[i]);
    g.closePath();
    g.fill(COLORS.cavity);

    g.moveTo(pts[i0].x, pts[i0].y + dir * offsets[i0]);
    for (let i = i0; i <= i1; i++) g.lineTo(pts[i].x, pts[i].y + dir * offsets[i]);
    g.stroke({ width: 10, color: COLORS.lining, cap: 'round', join: 'round' });
    g.moveTo(pts[i0].x, pts[i0].y + dir * offsets[i0]);
    for (let i = i0; i <= i1; i++) g.lineTo(pts[i].x, pts[i].y + dir * offsets[i]);
    g.stroke({
      width: 3,
      color: COLORS.highlight,
      alpha: dir === 1 ? 0.5 : 0.35,
      cap: 'round',
      join: 'round',
    });
  }

  floorYAt(x: number): number {
    return this.shape.centerYAt(x) + this.shape.radiusAt(x);
  }
}
