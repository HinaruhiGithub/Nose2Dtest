import { Container, Graphics, Text } from 'pixi.js';
import type { Action, Input } from '../core/Input';

export function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

const BTN_RADIUS = 42;
const BTN_ALPHA = 0.35;

export class TouchControls {
  readonly view = new Container();
  private leftBtn: Container;
  private rightBtn: Container;
  private jumpBtn: Container;
  private grabBtn: Container;
  private proneBtn: Container;
  private moveLeft = false;
  private moveRight = false;

  constructor(private input: Input) {
    this.leftBtn = this.makeArrowButton(-1);
    this.rightBtn = this.makeArrowButton(1);
    this.jumpBtn = this.makeActionButton('ジャンプ', 'jump');
    this.grabBtn = this.makeActionButton('つかむ', 'grab');
    this.proneBtn = this.makeActionButton('ふせる', 'prone');
    this.view.addChild(
      this.leftBtn,
      this.rightBtn,
      this.jumpBtn,
      this.grabBtn,
      this.proneBtn,
    );
  }

  private makeBase(): Graphics {
    const g = new Graphics();
    g.circle(0, 0, BTN_RADIUS).fill({ color: 0xffffff, alpha: BTN_ALPHA });
    g.circle(0, 0, BTN_RADIUS).stroke({ width: 3, color: 0xffffff, alpha: 0.6 });
    return g;
  }

  private makeArrowButton(dir: -1 | 1): Container {
    const btn = new Container();
    const base = this.makeBase();
    const arrow = new Graphics();
    arrow
      .poly([
        { x: dir * 16, y: 0 },
        { x: -dir * 8, y: -14 },
        { x: -dir * 8, y: 14 },
      ])
      .fill({ color: 0xffffff, alpha: 0.85 });
    btn.addChild(base, arrow);
    btn.eventMode = 'static';

    const setHeld = (held: boolean) => {
      if (dir < 0) this.moveLeft = held;
      else this.moveRight = held;
      btn.alpha = held ? 1.3 : 1;
      this.input.setVirtualMoveX((this.moveRight ? 1 : 0) - (this.moveLeft ? 1 : 0));
    };
    btn.on('pointerdown', () => setHeld(true));
    btn.on('pointerup', () => setHeld(false));
    btn.on('pointerupoutside', () => setHeld(false));
    btn.on('pointercancel', () => setHeld(false));
    return btn;
  }

  private makeActionButton(label: string, action: Action): Container {
    const btn = new Container();
    const base = this.makeBase();
    const text = new Text({
      text: label,
      style: { fill: 0xffffff, fontSize: 15, fontWeight: 'bold' },
    });
    text.anchor.set(0.5);
    btn.addChild(base, text);
    btn.eventMode = 'static';
    btn.on('pointerdown', () => {
      this.input.pushVirtualAction(action);
      btn.alpha = 1.3;
    });
    const release = () => {
      btn.alpha = 1;
    };
    btn.on('pointerup', release);
    btn.on('pointerupoutside', release);
    return btn;
  }

  resize(width: number, height: number): void {
    const margin = 26;
    const y = height - BTN_RADIUS - margin;
    this.leftBtn.position.set(BTN_RADIUS + margin, y);
    this.rightBtn.position.set(BTN_RADIUS * 3 + margin + 24, y);
    this.jumpBtn.position.set(width - BTN_RADIUS - margin, y);
    this.grabBtn.position.set(width - BTN_RADIUS * 3 - margin - 24, y);
    this.proneBtn.position.set(width - BTN_RADIUS - margin, y - BTN_RADIUS * 2 - 24);
  }
}
