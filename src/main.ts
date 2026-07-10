import { Application } from 'pixi.js';
import { SceneManager } from './core/SceneManager';
import { GameScene } from './scenes/GameScene';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#1a1216',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('app')!.appendChild(app.canvas);

  const manager = new SceneManager(app);
  await manager.goto(new GameScene());
}

void boot();
