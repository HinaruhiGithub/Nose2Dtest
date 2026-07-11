import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import goatFrontUrl from '../../referenceAssets/images/goatFront.png';
import type { Scene, SceneManager } from '../core/SceneManager';
import { PrologueScene } from './PrologueScene';

export class TitleScene implements Scene {
  readonly container = new Container();
  private bg = new Graphics();
  private vignette = new Graphics();
  private goat: Sprite | null = null;
  private title = new Text({
    text: 'ヤギの鼻の中',
    style: {
      fill: 0xffe9ec,
      fontSize: 64,
      fontWeight: 'bold',
      stroke: { color: 0x5a2430, width: 8 },
    },
  });
  private subtitle = new Text({
    text: '〜 吸い込まれたぬいぐるみを取り戻せ 〜',
    style: { fill: 0xf2c9d0, fontSize: 22 },
  });
  private prompt = new Text({
    text: 'クリック / タップ でスタート',
    style: { fill: 0xffffff, fontSize: 24 },
  });
  private hint = new Text({
    text: '←→: 移動   スペース: ジャンプ   ↓: ふせる   E: つかむ / はなす',
    style: { fill: 0xd9aab4, fontSize: 16 },
  });
  private time = 0;
  private screen = { w: 960, h: 540 };

  enter(manager: SceneManager): void {
    this.title.anchor.set(0.5);
    this.subtitle.anchor.set(0.5);
    this.prompt.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.container.addChild(this.bg);
    this.container.addChild(this.title, this.subtitle, this.prompt, this.hint, this.vignette);
    this.container.eventMode = 'static';
    this.container.once('pointerdown', () => {
      void manager.goto(new PrologueScene());
    });

    void Assets.load<Texture>(goatFrontUrl).then((tex) => {
      this.goat = new Sprite(tex);
      this.goat.anchor.set(0.5, 0.32);
      // 背景とテキストの間に挟む
      this.container.addChildAt(this.goat, 1);
      this.layout();
    });
  }

  exit(): void {}

  update(dtSec: number): void {
    this.time += dtSec;
    this.prompt.alpha = 0.6 + 0.4 * Math.sin(this.time * 3);
    if (this.goat) {
      // 呼吸でゆっくり揺れる
      const breath = Math.sin((this.time / 3.5) * Math.PI * 2);
      const base = (this.screen.h * 0.62) / 480;
      this.goat.scale.set(base * (1 + breath * 0.012));
      this.goat.rotation = breath * 0.015;
    }
  }

  private layout(): void {
    const { w, h } = this.screen;
    this.bg.clear();
    this.bg.rect(0, 0, w, h).fill(0x6e3641);
    this.bg.ellipse(w / 2, h * 1.05, w * 0.75, h * 0.35).fill(0x86424f);

    this.vignette.clear();
    this.vignette.rect(0, 0, w, h * 0.16).fill({ color: 0x2a161c, alpha: 0.35 });
    this.vignette.rect(0, h * 0.84, w, h * 0.16).fill({ color: 0x2a161c, alpha: 0.35 });

    this.goat?.position.set(w * 0.74, h * 0.42);
    this.title.position.set(w * 0.38, h * 0.34);
    this.subtitle.position.set(w * 0.38, h * 0.46);
    this.prompt.position.set(w * 0.38, h * 0.64);
    this.hint.position.set(w / 2, h * 0.92);
  }

  resize(width: number, height: number): void {
    this.screen = { w: width, h: height };
    this.layout();
  }
}
