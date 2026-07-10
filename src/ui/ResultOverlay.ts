import { Container, Graphics, Text } from 'pixi.js';

export interface ResultOptions {
  title: string;
  titleColor: number;
  onRetry: () => void;
  onTitle: () => void;
}

export class ResultOverlay {
  readonly view = new Container();
  private dim = new Graphics();
  private panel = new Container();

  constructor(options: ResultOptions) {
    this.dim.eventMode = 'static';
    this.view.addChild(this.dim);

    const title = new Text({
      text: options.title,
      style: {
        fill: options.titleColor,
        fontSize: 52,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 6 },
      },
    });
    title.anchor.set(0.5);
    title.position.set(0, -70);
    this.panel.addChild(title);

    this.panel.addChild(this.makeButton('リトライ', 0, 20, options.onRetry));
    this.panel.addChild(this.makeButton('タイトルへ', 0, 90, options.onTitle));
    this.view.addChild(this.panel);
  }

  private makeButton(label: string, x: number, y: number, onTap: () => void): Container {
    const button = new Container();
    const bg = new Graphics();
    bg.roundRect(-110, -26, 220, 52, 12).fill({ color: 0xffffff, alpha: 0.92 });
    const text = new Text({
      text: label,
      style: { fill: 0x333333, fontSize: 24, fontWeight: 'bold' },
    });
    text.anchor.set(0.5);
    button.addChild(bg, text);
    button.position.set(x, y);
    button.eventMode = 'static';
    button.cursor = 'pointer';
    button.on('pointerdown', onTap);
    return button;
  }

  resize(width: number, height: number): void {
    this.dim.clear();
    this.dim.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.55 });
    this.panel.position.set(width / 2, height / 2);
  }
}
