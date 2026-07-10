import { Body, Engine, Events, type IEventCollision } from 'matter-js';
import { Container } from 'pixi.js';
import { PARAMS } from '../config/params';
import { Input } from '../core/Input';
import type { Scene, SceneManager } from '../core/SceneManager';
import { generateCave } from '../game/CaveGenerator';
import { NoseCave } from '../game/NoseCave';
import { NoseHair, NoseHairField } from '../game/NoseHair';
import { Player } from '../game/Player';
import { PlayerAvatar } from '../game/PlayerAvatar';
import { SneezeSystem } from '../game/SneezeSystem';
import { LABEL_CEILING, LABEL_END_WALL, LABEL_FLOOR } from '../game/NoseCave';
import { Plush } from '../game/Plush';
import { HUD } from '../ui/HUD';
import { ResultOverlay } from '../ui/ResultOverlay';
import { isTouchDevice, TouchControls } from '../ui/TouchControls';
import { TitleScene } from './TitleScene';

const FIXED_DT = 1 / 60;

export class GameScene implements Scene {
  readonly container = new Container();
  private viewRotator = new Container();
  private world = new Container();
  private hud = new HUD();
  private sneeze = new SneezeSystem();

  private engine!: Engine;
  private input = new Input();
  private cave!: NoseCave;
  private player!: Player;
  private avatar = new PlayerAvatar();
  private hairField!: NoseHairField;
  private grabbedHair: NoseHair | null = null;
  private pendingPluck = false;
  private plush!: Plush;
  private manager!: SceneManager;
  private state: 'playing' | 'cleared' | 'gameover' = 'playing';
  private overlay: ResultOverlay | null = null;
  private touchControls: TouchControls | null = null;
  private screen = { w: 0, h: 0 };

  private faceAngle = 0;
  private time = 0;
  private accumulator = 0;
  private camera = { x: 0, y: 0 };
  private baseCenter = { x: 0, y: 0 };

  enter(manager: SceneManager): void {
    this.manager = manager;
    this.engine = Engine.create();
    this.engine.gravity.y = PARAMS.world.gravityY;

    this.cave = new NoseCave(this.engine, generateCave());
    this.world.addChild(this.cave.view);

    const plushX = this.cave.shape.length - 90;
    this.plush = new Plush(plushX, this.cave.shape.centerYAt(plushX) + 6);
    this.world.addChild(this.plush.view);

    this.hairField = new NoseHairField(this.cave.shape);
    this.world.addChild(this.hairField.view);

    const startX = 250;
    const startY =
      this.cave.floorYAt(startX) - PARAMS.player.height / 2 - 4;
    this.player = new Player(this.engine, startX, startY);
    this.world.addChild(this.avatar.view);

    this.viewRotator.addChild(this.world);
    this.container.addChild(this.viewRotator);
    this.container.addChild(this.hud.view);

    if (isTouchDevice()) {
      this.touchControls = new TouchControls(this.input);
      this.container.addChild(this.touchControls.view);
    }

    Events.on(this.engine, 'collisionStart', this.onCollisionStart);

    this.camera.x = startX;
    this.camera.y = this.cave.shape.centerYAt(startX);

    this.input.attach();
  }

  exit(): void {
    this.input.detach();
    Events.off(this.engine, 'collisionStart', this.onCollisionStart);
    Engine.clear(this.engine);
  }

  update(dtSec: number): void {
    this.time += dtSec;

    if (this.pendingPluck) {
      this.pendingPluck = false;
      this.sneeze.fillTickle();
    }
    this.sneeze.update(dtSec);
    this.faceAngle = this.sneeze.faceAngle(this.time);

    // 大くしゃみ: 主人公を入り口方向へ吹き飛ばす(掴まり中は耐える)
    if (this.sneeze.blowFired) {
      this.sneeze.blowFired = false;
      if (!this.player.hanging) {
        this.player.applyBlow(-this.sneeze.blowSpeed, -this.sneeze.blowSpeed * 0.12);
      }
    }

    // 顔の角度に合わせて重力ベクトルを回転(洞窟自体は回さない)
    const gy = PARAMS.world.gravityY;
    this.engine.gravity.x = Math.sin(this.faceAngle) * gy;
    this.engine.gravity.y = Math.cos(this.faceAngle) * gy;

    if (this.state === 'playing') {
      this.player.readFrameInput(this.input);
      this.handleGrabInput();
      // デバッグ用: Tキーでメーターを満タンにする
      if (this.input.consumePressed('debugTickle')) this.sneeze.fillTickle();
    }

    // ぬいぐるみの引っこ抜き
    if (this.state === 'playing' && this.player.pulling) {
      this.sneeze.addTickle(PARAMS.plush.tickleRisePerSec * dtSec);
      if (this.plush.pull(dtSec)) {
        this.player.pulling = false;
        this.state = 'cleared';
        this.showResult('ゲームクリア!', 0xffe08a);
      }
    }
    this.plush.update(dtSec, this.player.pulling);

    // 鼻の入り口から外に出たらゲームオーバー
    if (this.state === 'playing' && this.player.body.position.x < 0) {
      this.state = 'gameover';
      this.showResult('ゲームオーバー', 0xff8a8a);
    }

    this.accumulator += dtSec;
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      this.player.physicsStep();
      Engine.update(this.engine, FIXED_DT * 1000);
      this.stepHairs();
      this.player.updateGrounded();

      // 歩行による刺激
      if (
        this.state === 'playing' &&
        this.player.grounded &&
        !this.player.hanging &&
        !this.player.pulling
      ) {
        const distPx = Math.abs(this.player.body.velocity.x);
        if (distPx > 0.2) {
          const perPx =
            this.player.state === 'prone'
              ? PARAMS.tickle.walkPronePerPx
              : PARAMS.tickle.walkUprightPerPx;
          this.sneeze.addTickle(distPx * perPx);
        }
      }
    }

    const grabbable = this.grabbedHair
      ? null
      : this.hairField.nearestGrabbable(
          this.player.body.position.x,
          this.player.body.position.y,
          PARAMS.player.grabRange,
        );
    this.hairField.draw(grabbable);

    this.avatar.view.position.set(this.player.body.position.x, this.player.body.position.y);
    this.avatar.update(dtSec, {
      state: this.player.state,
      grounded: this.player.grounded,
      hanging: this.player.hanging || this.player.pulling,
      vx: this.player.body.velocity.x * 60,
      vy: this.player.body.velocity.y * 60,
      facing: this.player.facing,
    });

    // カメラ追従
    const lerp = Math.min(1, PARAMS.camera.followLerp * dtSec);
    this.camera.x += (this.player.body.position.x - this.camera.x) * lerp;
    this.camera.y += (this.player.body.position.y - this.camera.y) * lerp;

    this.viewRotator.rotation = this.faceAngle;
    const zoom = PARAMS.camera.zoom;
    this.viewRotator.scale.set(zoom);
    this.world.position.set(-this.camera.x, -this.camera.y);

    // くしゃみ・呼吸中のカメラ振動
    const shake = this.sneeze.shakeIntensity;
    if (shake > 0) {
      this.viewRotator.position.set(
        this.baseCenter.x + (Math.random() - 0.5) * 14 * shake,
        this.baseCenter.y + (Math.random() - 0.5) * 14 * shake,
      );
    } else {
      this.viewRotator.position.set(this.baseCenter.x, this.baseCenter.y);
    }

    this.hud.updateMeter(this.sneeze.meter);

    this.input.clearFrame();
  }

  private onCollisionStart = (e: IEventCollision<Engine>): void => {
    const t = PARAMS.tickle;
    for (const pair of e.pairs) {
      const { bodyA, bodyB } = pair;
      let other: Body | null = null;
      if (bodyA === this.player.body) other = bodyB;
      else if (bodyB === this.player.body) other = bodyA;
      if (!other) continue;
      if (
        other.label !== LABEL_FLOOR &&
        other.label !== LABEL_CEILING &&
        other.label !== LABEL_END_WALL
      )
        continue;
      const n = pair.collision.normal;
      const v = this.player.body.velocity;
      const impactPxPerSec = Math.abs(v.x * n.x + v.y * n.y) * 60;
      if (impactPxPerSec < t.bumpMinSpeed) continue;
      this.sneeze.addTickle(t.bumpBase + t.bumpPerSpeed * impactPxPerSec);
    }
  };

  private handleGrabInput(): void {
    if (!this.input.consumePressed('grab')) return;
    if (this.player.pulling) {
      this.player.pulling = false;
      return;
    }
    if (this.grabbedHair) {
      this.releaseHair();
      return;
    }
    const hair = this.hairField.nearestGrabbable(
      this.player.body.position.x,
      this.player.body.position.y,
      PARAMS.player.grabRange,
    );
    if (hair) {
      this.grabbedHair = hair;
      this.player.hanging = true;
      hair.addTipImpulse(this.player.body.velocity.x, this.player.body.velocity.y);
      return;
    }
    const dToPlush = Math.hypot(
      this.plush.x - this.player.body.position.x,
      this.plush.y - this.player.body.position.y,
    );
    if (dToPlush < PARAMS.plush.grabRange && this.plush.durability > 0) {
      this.player.pulling = true;
    }
  }

  private showResult(title: string, titleColor: number): void {
    this.overlay = new ResultOverlay({
      title,
      titleColor,
      onRetry: () => void this.manager.goto(new GameScene()),
      onTitle: () => void this.manager.goto(new TitleScene()),
    });
    this.overlay.resize(this.screen.w, this.screen.h);
    this.container.addChild(this.overlay.view);
  }

  private releaseHair(): void {
    this.grabbedHair = null;
    this.player.hanging = false;
  }

  private stepHairs(): void {
    const gravity = { x: this.engine.gravity.x, y: this.engine.gravity.y };
    this.hairField.step(
      gravity,
      this.grabbedHair,
      PARAMS.noseHair.hangWeight,
      this.sneeze.windX,
    );

    const hair = this.grabbedHair;
    if (!hair) return;

    const tipVel = hair.tipVelocity;
    const tipSpeedPxPerSec = Math.hypot(tipVel.x, tipVel.y) * 60;
    const drainAmount =
      (PARAMS.noseHair.drainPerSec + PARAMS.noseHair.drainPerSpeed * tipSpeedPxPerSec) *
      FIXED_DT;
    const justPlucked = hair.drain(drainAmount);

    // 体の中心は毛先から重力方向に少し下げる
    const gLen = Math.hypot(this.engine.gravity.x, this.engine.gravity.y) || 1;
    const ox = (this.engine.gravity.x / gLen) * PARAMS.player.hangOffset;
    const oy = (this.engine.gravity.y / gLen) * PARAMS.player.hangOffset;
    Body.setPosition(this.player.body, {
      x: hair.tip.x + ox,
      y: hair.tip.y + oy,
    });
    Body.setVelocity(this.player.body, { x: tipVel.x, y: tipVel.y });

    if (justPlucked) {
      this.releaseHair();
      this.pendingPluck = true;
    }
  }

  resize(width: number, height: number): void {
    this.screen = { w: width, h: height };
    this.baseCenter = { x: width / 2, y: height / 2 };
    this.viewRotator.position.set(width / 2, height / 2);
    this.overlay?.resize(width, height);
    this.touchControls?.resize(width, height);
  }
}
