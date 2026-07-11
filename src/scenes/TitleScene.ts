import { Container, Graphics, Text } from 'pixi.js';
import type { Scene, SceneManager } from '../core/SceneManager';
import { PrologueScene } from './PrologueScene';

export class TitleScene implements Scene {
  readonly container = new Container();
  private bg = new Graphics();
  private title = new Text({
    text: 'ヤギの鼻の中',
    style: {
      fill: 0xffe9ec,
      fontSize: 64,
      fontWeight: 'bold',
      stroke: { color: 0x5a2430, width: 8 },
    },
  });
  private prompt = new Text({
    text: 'クリック / タップ でスタート',
    style: { fill: 0xffffff, fontSize: 24 },
  });
  private time = 0;

  enter(manager: SceneManager): void {
    this.title.anchor.set(0.5);
    this.prompt.anchor.set(0.5);
    this.container.addChild(this.bg, this.title, this.prompt);
    this.container.eventMode = 'static';
    this.container.once('pointerdown', () => {
      void manager.goto(new PrologueScene());
    });
  }

  exit(): void {}

  update(dtSec: number): void {
    this.time += dtSec;
    this.prompt.alpha = 0.6 + 0.4 * Math.sin(this.time * 3);
  }

  resize(width: number, height: number): void {
    this.bg.clear();
    this.bg.rect(0, 0, width, height).fill(0x6e3641);
    this.title.position.set(width / 2, height * 0.38);
    this.prompt.position.set(width / 2, height * 0.62);
  }
}
