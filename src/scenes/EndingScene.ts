import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import goatRightUrl from '../../referenceAssets/images/goatRight.png';
import { PARAMS } from '../config/params';
import { playBigSneeze, playBreath } from '../core/Audio';
import type { Scene, SceneManager } from '../core/SceneManager';
import { loadChromaKeyedTexture } from '../core/TextureUtils';
import { PlayerAvatar } from '../game/PlayerAvatar';
import { Plush } from '../game/Plush';
import { ResultOverlay } from '../ui/ResultOverlay';
import { GameScene } from './GameScene';
import { TitleScene } from './TitleScene';

export type EndingMode = 'clear' | 'gameover';

// goatRight.png 内の部位の位置(画像ピクセル座標)
const NOSE_TIP = { x: 72, y: 648 };
const MOUTH = { x: 112, y: 775 };
const EAR_BELOW = { x: 400, y: 720 };

type Phase = 'drip' | 'fling' | 'suck' | 'breath' | 'sneeze' | 'done';

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

const SNOT_COLOR = 0xa5d24a;

export class EndingScene implements Scene {
  readonly container = new Container();
  private manager!: SceneManager;
  private ready = false;

  private stage = new Container();
  private bg = new Graphics();
  private goat!: Sprite;
  private goatScale = 1;
  private mouthHole = new Graphics();
  private snot = new Graphics();
  private flyGroup = new Container();
  private avatar = new PlayerAvatar();
  private plush = new Plush(0, 0);
  private fade = new Graphics();
  private overlay: ResultOverlay | null = null;

  private phase: Phase = 'drip';
  private phaseTime = 0;
  private time = 0;
  private uiTimer = -1;
  private screen = { w: 960, h: 540 };

  // ヤギの回転(呼吸・くしゃみ)
  private rot = 0;
  private rotTarget = 0;
  private breathIndex = 0;
  private breathTimer = 0;

  // 鼻水の塊 / 飛び出した主人公の運動
  private blob = { x: 0, y: 0, vx: 0, vy: 0, r: 10 };
  private suckFrom: { x: number; y: number } | null = null;

  constructor(private mode: EndingMode) {}

  enter(manager: SceneManager): void {
    this.manager = manager;
    this.container.addChild(this.stage, this.fade);
    this.stage.addChild(this.bg);
    this.fade.alpha = 1;
    void this.load();
  }

  private async load(): Promise<void> {
    const tex: Texture = await loadChromaKeyedTexture(goatRightUrl);
    this.goat = new Sprite(tex);
    this.goat.anchor.set(0.5, 1);

    // 口の開き(演出用の穴)は口の位置に子として重ねる
    this.mouthHole
      .ellipse(0, 0, 42, 58)
      .fill({ color: 0x2a1114, alpha: 0.95 });
    this.mouthHole.ellipse(0, 20, 30, 26).fill({ color: 0x7a2a35, alpha: 0.9 });
    this.mouthHole.position.set(
      MOUTH.x - tex.width / 2,
      MOUTH.y - tex.height,
    );
    this.mouthHole.rotation = -0.5;
    this.mouthHole.scale.set(0);
    this.goat.addChild(this.mouthHole);

    this.plush.view.scale.set(0.55);
    this.plush.view.position.set(10, -26);
    this.flyGroup.addChild(this.avatar.view, this.plush.view);
    this.flyGroup.visible = false;

    this.stage.addChild(this.goat, this.snot, this.flyGroup);
    this.layout();

    if (this.mode === 'gameover') {
      this.phase = 'drip';
      const nose = this.goatLocalToScreen(NOSE_TIP.x, NOSE_TIP.y);
      this.blob.x = nose.x;
      this.blob.y = nose.y;
    } else {
      this.phase = 'breath';
      this.breathTimer = 0.4;
    }
    this.ready = true;
  }

  exit(): void {}

  private goatLocalToScreen(px: number, py: number): { x: number; y: number } {
    const s = this.goatScale;
    const lx = (px - this.goat.texture.width / 2) * s;
    const ly = (py - this.goat.texture.height) * s;
    const cos = Math.cos(this.goat.rotation);
    const sin = Math.sin(this.goat.rotation);
    return {
      x: this.goat.position.x + lx * cos - ly * sin,
      y: this.goat.position.y + lx * sin + ly * cos,
    };
  }

  // 指定のローカル点が画面上の指定位置に来るようにヤギを配置する
  private placeGoat(local: { x: number; y: number }, screenPt: { x: number; y: number }): void {
    const s = this.goatScale;
    const lx = (local.x - this.goat.texture.width / 2) * s;
    const ly = (local.y - this.goat.texture.height) * s;
    const cos = Math.cos(this.goat.rotation);
    const sin = Math.sin(this.goat.rotation);
    this.goat.position.set(
      screenPt.x - (lx * cos - ly * sin),
      screenPt.y - (lx * sin + ly * cos),
    );
  }

  update(dtSec: number): void {
    if (!this.ready) return;
    this.time += dtSec;
    this.phaseTime += dtSec;
    const P = PARAMS.ending;
    const { w, h } = this.screen;

    this.fade.alpha = Math.max(0, this.fade.alpha - dtSec / 0.5);

    if (this.uiTimer >= 0) {
      this.uiTimer -= dtSec;
      if (this.uiTimer < 0) this.showUi();
    }

    if (this.mode === 'gameover') this.updateGameover(dtSec, P, w, h);
    else this.updateClear(dtSec, P, w, h);
  }

  private updateGameover(
    dtSec: number,
    P: typeof PARAMS.ending,
    w: number,
    h: number,
  ): void {
    // ヤギは静かに呼吸しながら立っている
    const g = PARAMS.goat;
    this.goat.rotation =
      g.idleBreathAngle * Math.sin((this.time / g.idleBreathPeriodSec) * Math.PI * 2);
    this.placeGoat(NOSE_TIP, { x: w * 0.62, y: h * 0.42 });
    const nose = this.goatLocalToScreen(NOSE_TIP.x, NOSE_TIP.y);
    const mouth = this.goatLocalToScreen(MOUTH.x, MOUTH.y);

    const wobX = Math.sin(this.time * 9) * 4;
    const wobY = Math.cos(this.time * 7) * 3;

    switch (this.phase) {
      case 'drip': {
        // 鼻水が入り口から伸びて垂れ下がる
        const t = easeInOut(Math.min(1, this.phaseTime / P.snotOutSec));
        this.blob.x = nose.x - w * 0.2 * t + wobX * t;
        this.blob.y = nose.y + h * 0.22 * t + wobY * t;
        this.blob.r = 10 + 14 * t;
        this.drawSnot(nose, true);
        if (this.phaseTime >= P.snotOutSec) {
          this.setPhase('fling');
          this.blob.vx = -w * 0.12;
          this.blob.vy = -h * 0.3;
        }
        break;
      }
      case 'fling': {
        // ちぎれて外へ飛び出す
        this.blob.vy += 700 * dtSec;
        this.blob.x += this.blob.vx * dtSec;
        this.blob.y += this.blob.vy * dtSec;
        this.drawSnot(nose, false);
        if (this.phaseTime >= P.snotFlySec) this.setPhase('suck');
        break;
      }
      case 'suck': {
        // ヤギが口を開けて鼻水ごと吸い込む
        const t = Math.min(1, this.phaseTime / P.swallowSec);
        this.mouthHole.scale.set(Math.min(1, t * 3.5));
        if (this.suckFrom === null) this.suckFrom = { x: this.blob.x, y: this.blob.y };
        // 口が開いてから吸い込み開始
        const pull = Math.max(0, (t - 0.3) / 0.7);
        const e = pull * pull;
        this.blob.x = this.suckFrom.x + (mouth.x - this.suckFrom.x) * e + wobX * (1 - e);
        this.blob.y = this.suckFrom.y + (mouth.y - this.suckFrom.y) * e + wobY * (1 - e);
        this.blob.r = 24 * (1 - e * 0.75);
        this.drawSnot(nose, false);
        if (t >= 1) {
          this.snot.clear();
          this.avatar.view.visible = false;
          this.mouthHole.scale.set(0);
          // ごくん
          this.setPhase('done');
          this.uiTimer = P.uiDelaySec;
        }
        break;
      }
      default:
        break;
    }

    // 鼻水の中の主人公
    if (this.phase === 'drip' || this.phase === 'fling' || this.phase === 'suck') {
      this.avatar.view.visible = true;
      this.avatar.view.position.set(this.blob.x, this.blob.y);
      this.avatar.view.scale.set(0.5 * Math.max(0.4, this.blob.r / 24));
      this.avatar.view.rotation = Math.sin(this.time * 5) * 0.5;
      if (this.avatar.view.parent !== this.stage) this.stage.addChild(this.avatar.view);
      this.avatar.update(dtSec, {
        state: 'upright',
        grounded: false,
        hanging: false,
        vx: 0,
        vy: 100,
        facing: 1,
      });
    }
  }

  private drawSnot(nose: { x: number; y: number }, attached: boolean): void {
    const s = this.snot;
    s.clear();
    if (attached) {
      // 鼻先から塊まで伸びる粘液の帯
      const midX = (nose.x + this.blob.x) / 2 + Math.sin(this.time * 6) * 6;
      const midY = (nose.y + this.blob.y) / 2 - 10;
      s.moveTo(nose.x, nose.y);
      s.quadraticCurveTo(midX, midY, this.blob.x, this.blob.y);
      s.stroke({ width: 10, color: SNOT_COLOR, alpha: 0.7, cap: 'round' });
      s.moveTo(nose.x, nose.y);
      s.quadraticCurveTo(midX, midY, this.blob.x, this.blob.y);
      s.stroke({ width: 4, color: 0xd8f0a0, alpha: 0.6, cap: 'round' });
    }
    // 主人公を包む鼻水の塊
    s.ellipse(this.blob.x, this.blob.y, this.blob.r * 1.15, this.blob.r * 1.3)
      .fill({ color: SNOT_COLOR, alpha: 0.55 });
    s.ellipse(this.blob.x - this.blob.r * 0.35, this.blob.y - this.blob.r * 0.45, this.blob.r * 0.3, this.blob.r * 0.2)
      .fill({ color: 0xffffff, alpha: 0.5 });
  }

  private updateClear(
    dtSec: number,
    P: typeof PARAMS.ending,
    w: number,
    h: number,
  ): void {
    const sneeze = PARAMS.sneeze;

    switch (this.phase) {
      case 'breath': {
        this.breathTimer -= dtSec;
        if (this.breathTimer <= 0 && this.breathIndex < sneeze.breathCount) {
          playBreath(this.breathIndex);
          this.breathIndex += 1;
          this.rotTarget = -P.breathAngleStep * this.breathIndex;
          this.breathTimer = P.breathIntervalSec;
        } else if (this.breathIndex >= sneeze.breathCount && this.breathTimer <= 0) {
          // 大きめのくしゃみ! 口から主人公とぬいぐるみが飛び出す
          playBigSneeze();
          this.rotTarget = 0.1;
          this.setPhase('sneeze');
          const mouth = this.goatLocalToScreen(MOUTH.x, MOUTH.y);
          this.flyGroup.visible = true;
          this.flyGroup.position.set(mouth.x, mouth.y);
          this.blob.vx = -P.launchSpeedX;
          this.blob.vy = -P.launchSpeedY;
          this.uiTimer = P.uiDelaySec;
        }
        break;
      }
      case 'sneeze':
      case 'done': {
        this.blob.vy += 1000 * dtSec;
        this.flyGroup.position.x += this.blob.vx * dtSec;
        this.flyGroup.position.y += this.blob.vy * dtSec;
        this.flyGroup.rotation -= dtSec * 5;
        this.avatar.update(dtSec, {
          state: 'upright',
          grounded: false,
          hanging: false,
          vx: this.blob.vx,
          vy: this.blob.vy,
          facing: -1,
        });
        this.plush.update(dtSec, false);
        break;
      }
      default:
        break;
    }

    // 顔の角度をなめらかに追従(くしゃみは素早い)
    const rate = this.phase === 'sneeze' || this.phase === 'done' ? 18 : 6;
    this.rot += (this.rotTarget - this.rot) * Math.min(1, rate * dtSec);
    this.goat.rotation = this.rot;

    // 耳の真下(主人公がいた位置)を常に画面中央へ
    const shake =
      this.phase === 'sneeze' && this.phaseTime < 0.5 ? 10 : this.phase === 'breath' ? 2 : 0;
    this.placeGoat(EAR_BELOW, {
      x: w / 2 + (Math.random() - 0.5) * shake,
      y: h * 0.48 + (Math.random() - 0.5) * shake,
    });
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  private showUi(): void {
    if (this.overlay) return;
    this.overlay = new ResultOverlay({
      title: this.mode === 'clear' ? 'ゲームクリア!' : 'ゲームオーバー',
      titleColor: this.mode === 'clear' ? 0xffe08a : 0xff8a8a,
      onRetry: () => void this.manager.goto(new GameScene()),
      onTitle: () => void this.manager.goto(new TitleScene()),
    });
    this.overlay.resize(this.screen.w, this.screen.h);
    this.container.addChild(this.overlay.view);
  }

  private layout(): void {
    const { w, h } = this.screen;
    const floorY = h * 0.82;
    this.goatScale = (h * 0.85) / this.goat.texture.height;
    this.goat.scale.set(this.goatScale);

    const g = this.bg;
    g.clear();
    g.rect(0, 0, w, floorY).fill(0x7a5a3a);
    for (let x = 0; x < w; x += 90) {
      g.rect(x, 0, 3, floorY).fill(0x5e4429);
    }
    g.rect(0, h * 0.12, w, 8).fill(0x5e4429);
    g.rect(0, h * 0.45, w, 8).fill(0x5e4429);
    g.rect(0, floorY, w, h - floorY).fill(0x9a7c4e);
    g.ellipse(w * 0.25, floorY + 8, 130, 24).fill({ color: 0xd9b96a, alpha: 0.6 });

    this.fade.clear();
    this.fade.rect(0, 0, w, h).fill(0x000000);
  }

  resize(width: number, height: number): void {
    this.screen = { w: width, h: height };
    if (this.ready) this.layout();
    this.overlay?.resize(width, height);
  }
}
