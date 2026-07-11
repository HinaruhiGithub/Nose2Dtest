import { Application } from 'pixi.js';
import { SceneManager } from './core/SceneManager';
import { TitleScene } from './scenes/TitleScene';

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

  // 横画面ロックに対応した環境では固定を試みる(非対応環境はCSSの回転案内に任せる)
  const orientation = screen.orientation as unknown as {
    lock?: (o: string) => Promise<void>;
  };
  orientation.lock?.('landscape').catch(() => {});

  // スマホの回転・アドレスバー開閉でキャンバスサイズを確実に追従させる
  const refit = () => app.resize();
  window.addEventListener('orientationchange', () => setTimeout(refit, 300));
  window.visualViewport?.addEventListener('resize', refit);

  const manager = new SceneManager(app);
  await manager.goto(new TitleScene());
}

void boot();
