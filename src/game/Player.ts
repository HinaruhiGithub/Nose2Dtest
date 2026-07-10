import { Bodies, Body, Composite, type Engine } from 'matter-js';
import { PARAMS } from '../config/params';
import type { Input } from '../core/Input';
import { LABEL_CEILING, LABEL_END_WALL, LABEL_FLOOR } from './NoseCave';

export const LABEL_PLAYER = 'player';

const STEP_PER_SEC = 60;

export type PlayerState = 'upright' | 'prone';

export class Player {
  body: Body;
  state: PlayerState = 'upright';
  facing: 1 | -1 = 1;
  grounded = false;
  hanging = false;

  private engine: Engine;
  private moveX = 0;
  private wantJump = false;
  private wantProneToggle = false;
  private controlLockTimer = 0;

  constructor(engine: Engine, x: number, y: number) {
    this.engine = engine;
    this.body = this.makeBody('upright', x, y);
    Composite.add(engine.world, this.body);
  }

  private makeBody(state: PlayerState, x: number, y: number): Body {
    const p = PARAMS.player;
    const w = state === 'upright' ? p.width : p.height * 0.85;
    const h = state === 'upright' ? p.height : p.width + 2;
    const body = Bodies.rectangle(x, y, w, h, {
      chamfer: { radius: Math.min(w, h) * 0.45 },
      label: LABEL_PLAYER,
      friction: 0.05,
      frictionAir: 0.01,
      restitution: 0.05,
    });
    Body.setInertia(body, Infinity);
    return body;
  }

  get halfHeight(): number {
    const p = PARAMS.player;
    return (this.state === 'upright' ? p.height : p.width + 2) / 2;
  }

  setState(next: PlayerState): void {
    if (this.state === next) return;
    const bottom = this.body.position.y + this.halfHeight;
    const velocity = { ...this.body.velocity };
    Composite.remove(this.engine.world, this.body);
    this.state = next;
    const newBody = this.makeBody(
      next,
      this.body.position.x,
      bottom - this.halfHeight,
    );
    Body.setVelocity(newBody, velocity);
    Composite.add(this.engine.world, newBody);
    this.body = newBody;
  }

  // 描画フレームごとに入力を取り込む(物理ステップは可変回数走るため分離)
  readFrameInput(input: Input): void {
    this.moveX = input.moveX;
    if (input.consumePressed('jump')) this.wantJump = true;
    if (input.consumePressed('prone')) this.wantProneToggle = true;
  }

  // くしゃみ等で吹き飛ばされる(しばらく操作不能になる)
  applyBlow(vxPxPerSec: number, vyPxPerSec: number): void {
    Body.setVelocity(this.body, {
      x: this.body.velocity.x + vxPxPerSec / STEP_PER_SEC,
      y: this.body.velocity.y + vyPxPerSec / STEP_PER_SEC,
    });
    this.grounded = false;
    this.controlLockTimer = PARAMS.sneeze.controlLockSec;
  }

  // 物理ステップ直前に呼ぶ
  physicsStep(): void {
    const p = PARAMS.player;

    if (this.hanging) {
      this.wantJump = false;
      this.wantProneToggle = false;
      return;
    }

    if (this.controlLockTimer > 0) {
      this.controlLockTimer -= 1 / STEP_PER_SEC;
      this.wantJump = false;
      this.wantProneToggle = false;
      return;
    }

    if (this.wantProneToggle) {
      this.wantProneToggle = false;
      this.setState(this.state === 'upright' ? 'prone' : 'upright');
    }

    if (this.moveX !== 0) this.facing = this.moveX > 0 ? 1 : -1;

    const speed = this.state === 'upright' ? p.walkSpeedUpright : p.walkSpeedProne;
    const targetVx = (this.moveX * speed) / STEP_PER_SEC;
    const v = this.body.velocity;

    if (this.grounded) {
      Body.setVelocity(this.body, { x: targetVx, y: v.y });
    } else {
      const blended = v.x + (targetVx - v.x) * p.airControl * 0.15;
      Body.setVelocity(this.body, { x: blended, y: v.y });
    }

    if (this.wantJump) {
      this.wantJump = false;
      if (this.grounded) {
        if (this.state === 'prone') this.setState('upright');
        Body.setVelocity(this.body, {
          x: this.body.velocity.x,
          y: -p.jumpVelocity / STEP_PER_SEC,
        });
        this.grounded = false;
      }
    }
  }

  // 物理ステップ直後に接地判定を更新する
  updateGrounded(): void {
    this.grounded = false;
    for (const pair of this.engine.pairs.list) {
      if (!pair.isActive) continue;
      const { bodyA, bodyB } = pair;
      let other: Body | null = null;
      if (bodyA === this.body) other = bodyB;
      else if (bodyB === this.body) other = bodyA;
      if (!other) continue;
      if (
        other.label !== LABEL_FLOOR &&
        other.label !== LABEL_CEILING &&
        other.label !== LABEL_END_WALL
      )
        continue;
      // 法線を「相手→プレイヤー」向きに揃え、上向きなら接地
      let { x: nx, y: ny } = pair.collision.normal;
      const relX = this.body.position.x - other.position.x;
      const relY = this.body.position.y - other.position.y;
      if (nx * relX + ny * relY < 0) {
        nx = -nx;
        ny = -ny;
      }
      if (ny < -0.4) this.grounded = true;
    }
  }

  get speedPxPerSec(): number {
    return Math.hypot(this.body.velocity.x, this.body.velocity.y) * STEP_PER_SEC;
  }
}
