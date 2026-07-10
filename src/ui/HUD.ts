import { Container, Graphics, Text } from 'pixi.js';

const BAR_W = 220;
const BAR_H = 16;

export class HUD {
  readonly view = new Container();
  private bar = new Graphics();
  private label = new Text({
    text: 'ムズムズ',
    style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' },
  });

  constructor() {
    this.label.position.set(16, 10);
    this.bar.position.set(16, 32);
    this.view.addChild(this.label, this.bar);
  }

  updateMeter(value: number): void {
    const g = this.bar;
    g.clear();
    g.roundRect(0, 0, BAR_W, BAR_H, 8).fill({ color: 0x000000, alpha: 0.45 });
    const v = Math.max(0, Math.min(1, value));
    if (v > 0) {
      const color = v < 0.5 ? 0x8fd465 : v < 0.8 ? 0xf2c14e : 0xe05252;
      g.roundRect(2, 2, (BAR_W - 4) * v, BAR_H - 4, 6).fill(color);
    }
    g.roundRect(0, 0, BAR_W, BAR_H, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
  }
}
