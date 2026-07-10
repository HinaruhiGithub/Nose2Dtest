import { Application, Container } from 'pixi.js';

export interface Scene {
  readonly container: Container;
  enter(manager: SceneManager): void | Promise<void>;
  exit(): void;
  update(dtSec: number): void;
  resize(width: number, height: number): void;
}

export class SceneManager {
  readonly app: Application;
  private current: Scene | null = null;

  constructor(app: Application) {
    this.app = app;

    app.ticker.add((ticker) => {
      const dtSec = Math.min(ticker.deltaMS / 1000, 1 / 20);
      this.current?.update(dtSec);
    });

    window.addEventListener('resize', () => this.dispatchResize());
  }

  get width(): number {
    return this.app.renderer.width / this.app.renderer.resolution;
  }

  get height(): number {
    return this.app.renderer.height / this.app.renderer.resolution;
  }

  async goto(scene: Scene): Promise<void> {
    if (this.current) {
      this.current.exit();
      this.app.stage.removeChild(this.current.container);
      this.current.container.destroy({ children: true });
      this.current = null;
    }
    this.app.stage.addChild(scene.container);
    await scene.enter(this);
    this.current = scene;
    scene.resize(this.width, this.height);
  }

  private dispatchResize(): void {
    this.current?.resize(this.width, this.height);
  }
}
