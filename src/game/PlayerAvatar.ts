import { Container, Graphics } from 'pixi.js';

export interface AvatarInfo {
  state: 'upright' | 'prone';
  grounded: boolean;
  hanging: boolean;
  vx: number;
  vy: number;
  facing: 1 | -1;
}

interface Pose {
  head: [number, number];
  neck: [number, number];
  hip: [number, number];
  handL: [number, number];
  handR: [number, number];
  elbowL: [number, number];
  elbowR: [number, number];
  footL: [number, number];
  footR: [number, number];
  kneeL: [number, number];
  kneeR: [number, number];
}

const SKIN = 0xf2c9a0;
const SHIRT = 0xd94f30;
const SHIRT_DARK = 0xa93a22;
const PANTS = 0x35406b;
const PANTS_DARK = 0x272f4f;
const HAIR = 0x5b3a24;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPt(a: [number, number], b: [number, number], t: number): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

// ボーンベース風の手続きアニメーション。関節位置を目標ポーズへなめらかに補間して描画する。
export class PlayerAvatar {
  readonly view = new Container();
  private g = new Graphics();
  private walkPhase = 0;
  private proneBlend = 0;
  private hangBlend = 0;
  private airBlend = 0;
  private current: Pose | null = null;

  constructor() {
    this.view.addChild(this.g);
  }

  private uprightPose(f: number, ph: number, moving: boolean, air: number): Pose {
    const swing = moving ? 1 : 0;
    const s = Math.sin(ph) * swing;
    const bob = Math.abs(Math.cos(ph)) * swing * 1.5;
    const lean = moving ? 2 * f : 0;
    const tuck = air * 8;
    return {
      hip: [0, 8 - bob],
      neck: [lean, -16 - bob],
      head: [lean * 1.6, -25 - bob],
      handL: [lean + -s * 9 * f + 2, 4 - air * 10],
      handR: [lean + s * 9 * f - 2, 4 - air * 10],
      elbowL: [lean + -s * 5 * f + 4 * f, -6],
      elbowR: [lean + s * 5 * f - 4 * f, -6],
      footL: [s * 11 * f, 30 - tuck - Math.max(0, Math.sin(ph)) * swing * 3],
      footR: [-s * 11 * f, 30 - tuck - Math.max(0, -Math.sin(ph)) * swing * 3],
      kneeL: [s * 7 * f + 2 * f, 19 - tuck * 0.7],
      kneeR: [-s * 7 * f + 2 * f, 19 - tuck * 0.7],
    };
  }

  private pronePose(f: number, ph: number, moving: boolean): Pose {
    const s = Math.sin(ph) * (moving ? 1 : 0);
    return {
      hip: [-12 * f, 20],
      neck: [10 * f, 17],
      head: [21 * f, 13],
      handL: [(16 + s * 5) * f, 26],
      handR: [(16 - s * 5) * f, 26],
      elbowL: [(12 + s * 3) * f, 18],
      elbowR: [(12 - s * 3) * f, 18],
      footL: [(-28 - s * 4) * f, 24],
      footR: [(-28 + s * 4) * f, 24],
      kneeL: [(-20 - s * 2) * f, 24],
      kneeR: [(-20 + s * 2) * f, 24],
    };
  }

  private hangPose(f: number, sway: number): Pose {
    return {
      hip: [sway * 3, 10],
      neck: [sway, -14],
      head: [sway * 0.5 + 2 * f, -23],
      handL: [-4, -30],
      handR: [4, -30],
      elbowL: [-6, -22],
      elbowR: [6, -22],
      footL: [sway * 5 - 3, 28],
      footR: [sway * 5 + 3, 28],
      kneeL: [sway * 4 - 3 + 2 * f, 20],
      kneeR: [sway * 4 + 3 + 2 * f, 20],
    };
  }

  update(dtSec: number, info: AvatarInfo): void {
    const moving = Math.abs(info.vx) > 8;
    this.walkPhase += Math.abs(info.vx) * dtSec * 0.055 + (moving ? dtSec * 2 : 0);

    const approach = (v: number, target: number, rate: number) =>
      v + (target - v) * Math.min(1, rate * dtSec);
    this.proneBlend = approach(this.proneBlend, info.state === 'prone' ? 1 : 0, 10);
    this.hangBlend = approach(this.hangBlend, info.hanging ? 1 : 0, 12);
    this.airBlend = approach(this.airBlend, !info.grounded && !info.hanging ? 1 : 0, 8);

    const f = info.facing;
    const up = this.uprightPose(f, this.walkPhase, moving, this.airBlend);
    const pr = this.pronePose(f, this.walkPhase, moving);
    const hang = this.hangPose(f, Math.max(-1, Math.min(1, info.vx / 200)));

    const keys = Object.keys(up) as (keyof Pose)[];
    const target = {} as Pose;
    for (const k of keys) {
      const base = lerpPt(up[k], pr[k], this.proneBlend);
      target[k] = lerpPt(base, hang[k], this.hangBlend);
    }

    if (!this.current) {
      this.current = target;
    } else {
      for (const k of keys) {
        this.current[k] = lerpPt(this.current[k], target[k], Math.min(1, 25 * dtSec));
      }
    }
    this.draw(this.current, f);
  }

  private limb(
    from: [number, number],
    mid: [number, number],
    to: [number, number],
    width: number,
    color: number,
  ): void {
    this.g.moveTo(from[0], from[1]);
    this.g.quadraticCurveTo(mid[0], mid[1], to[0], to[1]);
    this.g.stroke({ width, color, cap: 'round', join: 'round' });
  }

  private draw(p: Pose, f: number): void {
    const g = this.g;
    g.clear();

    // 奥側の腕・脚(暗い色)
    this.limb(p.hip, p.kneeR, p.footR, 7, PANTS_DARK);
    this.limb(p.neck, p.elbowR, p.handR, 5, SHIRT_DARK);
    // 胴体
    g.moveTo(p.neck[0], p.neck[1]);
    g.lineTo(p.hip[0], p.hip[1]);
    g.stroke({ width: 13, color: SHIRT, cap: 'round' });
    // 手前側の脚・腕
    this.limb(p.hip, p.kneeL, p.footL, 7, PANTS);
    this.limb(p.neck, p.elbowL, p.handL, 5, SHIRT);
    // 頭
    g.circle(p.head[0], p.head[1], 10).fill(SKIN);
    // 髪
    g.arc(p.head[0], p.head[1], 10, Math.PI + 0.3, Math.PI * 2 - 0.3).fill(HAIR);
    g.circle(p.head[0] - 3 * f, p.head[1] - 8, 4).fill(HAIR);
    // 目
    g.circle(p.head[0] + 5 * f, p.head[1] - 1, 1.6).fill(0x2b1c12);
  }
}
