import { Container, Text } from 'pixi.js';
import type { Scene, SceneManager } from '../core/SceneManager';

export class GameScene implements Scene {
  readonly container = new Container();
  private label = new Text({
    text: 'Nose2D: scaffold OK',
    style: { fill: 0xffffff, fontSize: 24 },
  });

  enter(_manager: SceneManager): void {
    this.container.addChild(this.label);
  }

  exit(): void {}

  update(_dtSec: number): void {}

  resize(width: number, height: number): void {
    this.label.position.set(
      (width - this.label.width) / 2,
      (height - this.label.height) / 2,
    );
  }
}
