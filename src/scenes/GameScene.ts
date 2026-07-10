import { Engine } from 'matter-js';
import { Container } from 'pixi.js';
import { PARAMS } from '../config/params';
import { Input } from '../core/Input';
import type { Scene, SceneManager } from '../core/SceneManager';
import { generateCave } from '../game/CaveGenerator';
import { NoseCave } from '../game/NoseCave';
import { Player } from '../game/Player';
import { PlayerAvatar } from '../game/PlayerAvatar';

const FIXED_DT = 1 / 60;

export class GameScene implements Scene {
  readonly container = new Container();
  private viewRotator = new Container();
  private world = new Container();
  private hud = new Container();

  private engine!: Engine;
  private input = new Input();
  private cave!: NoseCave;
  private player!: Player;
  private avatar = new PlayerAvatar();

  private faceAngle = 0;
  private time = 0;
  private accumulator = 0;
  private camera = { x: 0, y: 0 };

  enter(_manager: SceneManager): void {
    this.engine = Engine.create();
    this.engine.gravity.y = PARAMS.world.gravityY;

    this.cave = new NoseCave(this.engine, generateCave());
    this.world.addChild(this.cave.view);

    const startX = 250;
    const startY =
      this.cave.floorYAt(startX) - PARAMS.player.height / 2 - 4;
    this.player = new Player(this.engine, startX, startY);
    this.world.addChild(this.avatar.view);

    this.viewRotator.addChild(this.world);
    this.container.addChild(this.viewRotator);
    this.container.addChild(this.hud);

    this.camera.x = startX;
    this.camera.y = this.cave.shape.centerYAt(startX);

    this.input.attach();
  }

  exit(): void {
    this.input.detach();
    Engine.clear(this.engine);
  }

  update(dtSec: number): void {
    this.time += dtSec;

    // ヤギの呼吸による顔角度のゆらぎ(くしゃみ実装時に拡張)
    const g = PARAMS.goat;
    this.faceAngle =
      g.idleBreathAngle * Math.sin((this.time / g.idleBreathPeriodSec) * Math.PI * 2);

    // 顔の角度に合わせて重力ベクトルを回転(洞窟自体は回さない)
    const gy = PARAMS.world.gravityY;
    this.engine.gravity.x = Math.sin(this.faceAngle) * gy;
    this.engine.gravity.y = Math.cos(this.faceAngle) * gy;

    this.player.readFrameInput(this.input);

    this.accumulator += dtSec;
    while (this.accumulator >= FIXED_DT) {
      this.accumulator -= FIXED_DT;
      this.player.physicsStep();
      Engine.update(this.engine, FIXED_DT * 1000);
      this.player.updateGrounded();
    }

    this.avatar.view.position.set(this.player.body.position.x, this.player.body.position.y);
    this.avatar.update(dtSec, {
      state: this.player.state,
      grounded: this.player.grounded,
      hanging: this.player.hanging,
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

    this.input.clearFrame();
  }

  resize(width: number, height: number): void {
    this.viewRotator.position.set(width / 2, height / 2);
  }
}
