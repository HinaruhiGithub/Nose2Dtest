import { Container, Graphics } from 'pixi.js';
import { PARAMS } from '../config/params';

const BODY_COLOR = 0xc9944a;
const BELLY_COLOR = 0xe8c98f;
const EAR_INNER = 0xa8703a;

// 鼻の奥に挟まったお気に入りのぬいぐるみ(ゴール)
export class Plush {
  readonly view = new Container();
  readonly x: number;
  readonly y: number;
  durability = 1;
  private body = new Graphics();
  private gauge = new Graphics();
  private wigglePhase = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.view.position.set(x, y);
    this.draw();
    this.view.addChild(this.body, this.gauge);
  }

  private draw(): void {
    const g = this.body;
    // 耳
    g.circle(-14, -26, 8).fill(BODY_COLOR);
    g.circle(14, -26, 8).fill(BODY_COLOR);
    g.circle(-14, -26, 4).fill(EAR_INNER);
    g.circle(14, -26, 4).fill(EAR_INNER);
    // 頭
    g.circle(0, -14, 16).fill(BODY_COLOR);
    // 胴体
    g.ellipse(0, 12, 17, 18).fill(BODY_COLOR);
    g.ellipse(0, 14, 10, 12).fill(BELLY_COLOR);
    // 手足
    g.circle(-15, 4, 6).fill(BODY_COLOR);
    g.circle(15, 4, 6).fill(BODY_COLOR);
    g.circle(-11, 27, 7).fill(BODY_COLOR);
    g.circle(11, 27, 7).fill(BODY_COLOR);
    // 顔
    g.circle(-5, -16, 1.8).fill(0x3a2a1a);
    g.circle(5, -16, 1.8).fill(0x3a2a1a);
    g.ellipse(0, -10, 3.5, 2.5).fill(0x6b4a2a);
  }

  // 引っこ抜き中の耐久減少。クリア確定の瞬間だけ true を返す
  pull(dtSec: number): boolean {
    if (this.durability <= 0) return false;
    this.durability -= dtSec / PARAMS.plush.pullDurationSec;
    if (this.durability <= 0) {
      this.durability = 0;
      return true;
    }
    return false;
  }

  update(dtSec: number, pulling: boolean): void {
    if (pulling) {
      this.wigglePhase += dtSec * 30;
      this.body.rotation = Math.sin(this.wigglePhase) * 0.12;
      this.body.position.set(
        Math.sin(this.wigglePhase * 1.7) * 2,
        Math.sin(this.wigglePhase * 1.3) * 1.5,
      );
    } else {
      this.body.rotation *= 0.9;
      this.body.position.set(this.body.position.x * 0.9, this.body.position.y * 0.9);
    }

    this.gauge.clear();
    if (this.durability < 1 && this.durability > 0) {
      const w = 44;
      this.gauge.rect(-w / 2, -48, w, 6).fill({ color: 0x000000, alpha: 0.5 });
      this.gauge.rect(-w / 2, -48, w * this.durability, 6).fill(0xf2c14e);
    }
  }
}
