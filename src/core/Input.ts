export type Action = 'jump' | 'prone' | 'grab' | 'debugTickle';

const KEY_TO_ACTION: Record<string, Action> = {
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  ArrowDown: 'prone',
  KeyS: 'prone',
  KeyE: 'grab',
  KeyF: 'grab',
  KeyT: 'debugTickle',
};

export class Input {
  private keys = new Set<string>();
  private pressedQueue = new Set<Action>();
  private virtualMoveX = 0;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keys.add(e.code);
    const action = KEY_TO_ACTION[e.code];
    if (action) {
      this.pressedQueue.add(action);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  get moveX(): number {
    let x = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1;
    if (x === 0) x = this.virtualMoveX;
    return Math.max(-1, Math.min(1, x));
  }

  consumePressed(action: Action): boolean {
    if (this.pressedQueue.has(action)) {
      this.pressedQueue.delete(action);
      return true;
    }
    return false;
  }

  clearFrame(): void {
    this.pressedQueue.clear();
  }

  setVirtualMoveX(x: number): void {
    this.virtualMoveX = x;
  }

  pushVirtualAction(action: Action): void {
    this.pressedQueue.add(action);
  }
}
