import { Container, Graphics } from 'pixi.js';
import { PARAMS } from '../config/params';
import { mulberry32, type CaveShape } from './CaveGenerator';

const NODE_COUNT = 4;
const HAIR_COLOR = 0x4a352a;
const HAIR_TIP_COLOR = 0x6b4f3d;

interface Vec {
  x: number;
  y: number;
}

export class NoseHair {
  readonly root: Vec;
  readonly restDir: Vec;
  durability = 1;
  plucked = false;
  private regrowTimer = 0;
  private nodes: Vec[] = [];
  private prevNodes: Vec[] = [];
  private readonly segLen: number;

  constructor(root: Vec, restDir: Vec) {
    this.root = root;
    this.restDir = restDir;
    this.segLen = PARAMS.noseHair.length / (NODE_COUNT - 1);
    this.resetNodes();
  }

  private resetNodes(): void {
    this.nodes = [];
    this.prevNodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const p = {
        x: this.root.x + this.restDir.x * this.segLen * i,
        y: this.root.y + this.restDir.y * this.segLen * i,
      };
      this.nodes.push({ ...p });
      this.prevNodes.push({ ...p });
    }
  }

  get tip(): Vec {
    return this.nodes[NODE_COUNT - 1];
  }

  get tipVelocity(): Vec {
    const tip = this.nodes[NODE_COUNT - 1];
    const prev = this.prevNodes[NODE_COUNT - 1];
    return { x: tip.x - prev.x, y: tip.y - prev.y };
  }

  // 掴んだ瞬間にプレイヤーの勢いを毛先へ伝える
  addTipImpulse(vx: number, vy: number): void {
    const tip = this.nodes[NODE_COUNT - 1];
    this.prevNodes[NODE_COUNT - 1] = { x: tip.x - vx, y: tip.y - vy };
  }

  step(gravity: Vec, grabbedLoad: number, windX: number): void {
    const p = PARAMS.noseHair;
    if (this.plucked) {
      this.regrowTimer -= 1 / 60;
      if (this.regrowTimer <= 0) {
        this.plucked = false;
        this.durability = 1;
        this.resetNodes();
      }
      return;
    }

    for (let i = 1; i < NODE_COUNT; i++) {
      const node = this.nodes[i];
      const prev = this.prevNodes[i];
      const vx = (node.x - prev.x) * p.damping;
      const vy = (node.y - prev.y) * p.damping;
      this.prevNodes[i] = { ...node };
      const tipWeight = i === NODE_COUNT - 1 ? grabbedLoad : 0;
      node.x += vx + gravity.x * 0.05 + windX + gravity.x * tipWeight;
      node.y += vy + gravity.y * 0.05 + gravity.y * tipWeight;
    }

    // 根元方向への距離拘束と、生えている向きへ戻ろうとするばね
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 1; i < NODE_COUNT; i++) {
        const a = this.nodes[i - 1];
        const b = this.nodes[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const diff = (dist - this.segLen) / dist;
        if (i === 1) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
        }
      }
      this.nodes[0].x = this.root.x;
      this.nodes[0].y = this.root.y;
    }

    const springScale = grabbedLoad > 0 ? 0.25 : 1;
    for (let i = 1; i < NODE_COUNT; i++) {
      const rest = {
        x: this.root.x + this.restDir.x * this.segLen * i,
        y: this.root.y + this.restDir.y * this.segLen * i,
      };
      const node = this.nodes[i];
      node.x += (rest.x - node.x) * p.stiffness * springScale;
      node.y += (rest.y - node.y) * p.stiffness * springScale;
    }
  }

  // 耐久を減らす。抜けた瞬間だけ true を返す
  drain(amount: number): boolean {
    if (this.plucked) return false;
    this.durability -= amount;
    if (this.durability <= 0) {
      this.durability = 0;
      this.plucked = true;
      this.regrowTimer = PARAMS.noseHair.regrowSec;
      return true;
    }
    return false;
  }

  drawInto(g: Graphics, highlightTip: boolean): void {
    if (this.plucked) return;
    const n = this.nodes;
    g.moveTo(n[0].x, n[0].y);
    for (let i = 1; i < n.length; i++) {
      const midX = (n[i - 1].x + n[i].x) / 2;
      const midY = (n[i - 1].y + n[i].y) / 2;
      g.quadraticCurveTo(n[i - 1].x, n[i - 1].y, midX, midY);
    }
    g.lineTo(n[n.length - 1].x, n[n.length - 1].y);
    g.stroke({ width: 5, color: HAIR_COLOR, cap: 'round', join: 'round' });

    const tip = this.tip;
    g.circle(tip.x, tip.y, 3.5).fill(HAIR_TIP_COLOR);
    if (highlightTip) {
      g.circle(tip.x, tip.y, 9).stroke({ width: 2, color: 0xffe08a, alpha: 0.9 });
    }
    if (this.durability < 1) {
      // 耐久ゲージ(毛先の上に小さく表示)
      const w = 26;
      const x = tip.x - w / 2;
      const y = tip.y - 18;
      g.rect(x, y, w, 4).fill({ color: 0x000000, alpha: 0.5 });
      g.rect(x, y, w * this.durability, 4).fill(
        this.durability > 0.35 ? 0x8fd465 : 0xe05252,
      );
    }
  }
}

export class NoseHairField {
  readonly hairs: NoseHair[] = [];
  readonly view = new Container();
  private g = new Graphics();

  constructor(shape: CaveShape, seed = 987654) {
    const p = PARAMS.noseHair;
    const rand = mulberry32(seed);
    let s = 450;
    const endS = shape.length - 350;
    while (s < endS) {
      const onFloor = rand() < 0.5;
      const cy = shape.centerYAt(s);
      const r = shape.radiusAt(s);
      const root = { x: s, y: onFloor ? cy + r : cy - r };
      // 生える向きは洞窟の中心へ向ける
      const dirY = onFloor ? -1 : 1;
      const dir = { x: 0, y: dirY };
      this.hairs.push(new NoseHair(root, dir));
      s += p.spacing + (rand() * 2 - 1) * p.spacingJitter;
    }
    this.view.addChild(this.g);
  }

  nearestGrabbable(x: number, y: number, range: number): NoseHair | null {
    let best: NoseHair | null = null;
    let bestDist = range;
    for (const hair of this.hairs) {
      if (hair.plucked) continue;
      const d = Math.hypot(hair.tip.x - x, hair.tip.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = hair;
      }
    }
    return best;
  }

  step(gravity: Vec, grabbed: NoseHair | null, grabbedLoad: number, windX: number): void {
    for (const hair of this.hairs) {
      hair.step(gravity, hair === grabbed ? grabbedLoad : 0, windX);
    }
  }

  draw(grabbable: NoseHair | null): void {
    this.g.clear();
    for (const hair of this.hairs) {
      hair.drawInto(this.g, hair === grabbable);
    }
  }
}
