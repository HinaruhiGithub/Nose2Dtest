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

  constructor(engine: Engine, shape: CaveShape) {
    this.shape = shape;
    this.buildBodies(engine);
    this.draw();
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

    const minY = Math.min(...ceiling.map((p) => p.y));
    const maxY = Math.max(...floor.map((p) => p.y));
    const pad = 400;

    g.rect(-pad, minY - pad, length + pad * 2, maxY - minY + pad * 2).fill(COLORS.fleshOuter);
    g.rect(-pad, minY - pad * 0.4, length + pad * 2, maxY - minY + pad * 0.8).fill(
      COLORS.fleshInner,
    );

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

  floorYAt(x: number): number {
    return this.shape.centerYAt(x) + this.shape.radiusAt(x);
  }
}
