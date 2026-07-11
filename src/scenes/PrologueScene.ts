import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import goatFrontUrl from '../../referenceAssets/images/goatFront.png';
import goatRightUrl from '../../referenceAssets/images/goatRight.png';
import { PARAMS } from '../config/params';
import type { Scene, SceneManager } from '../core/SceneManager';
import { loadChromaKeyedTexture } from '../core/TextureUtils';
import { PlayerAvatar } from '../game/PlayerAvatar';
import { Plush } from '../game/Plush';
import { GameScene } from './GameScene';

type Phase = 'barn' | 'notice' | 'approach' | 'pov' | 'suction' | 'blackout' | 'wake';

// goatFront.png 内の鼻の位置(画像ピクセル座標)
const NOSE_CENTER = { x: 361, y: 742 };
const NOSTRIL_OFFSET = 23;
// goatFront.png 内で頭部が占めるおおよその高さ
const HEAD_HEIGHT_PX = 480;

const WAKE_LINES = [
  'ん…… ここは……?  鼻の中!?',
  'たいへんだ! ぬいぐるみが鼻の奥まで吸い込まれてしまった……',
  '壁をくすぐりすぎると、くしゃみで外まで吹き飛ばされてしまう。\nそっと奥まで進んで、ぬいぐるみを取り返そう!',
];

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

interface SuckParticle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class PrologueScene implements Scene {
  readonly container = new Container();
  private manager!: SceneManager;
  private ready = false;
  private starting = false;

  private phase: Phase = 'barn';
  private phaseTime = 0;
  private time = 0;
  private screen = { w: 960, h: 540 };

  private rootBg = new Graphics();
  private fade = new Graphics();
  private skipHint = new Text({
    text: 'タップでスキップ ▶',
    style: { fill: 0xffffff, fontSize: 16 },
  });

  // ヤギ舎ビュー
  private barnView = new Container();
  private barnBg = new Graphics();
  private goat!: Sprite;
  private goatScale = 1;
  private goatX = 0;
  private goatPrevX = 0;
  private goatNoticeX = 0;
  private noticeMark = new Text({
    text: '!',
    style: { fill: 0xfff2a0, fontSize: 52, fontWeight: 'bold', stroke: { color: 0x4a2a10, width: 6 } },
  });
  private avatarBarn = new PlayerAvatar();
  private plushBarn = new Plush(0, 0);

  // 主人公目線(鼻ドアップ)ビュー
  private povView = new Container();
  private povBg = new Graphics();
  private face = new Container();
  private nostrilL = new Graphics();
  private nostrilR = new Graphics();
  private particleLayer = new Container();
  private particles: SuckParticle[] = [];
  private avatarPov = new PlayerAvatar();
  private plushPov = new Plush(0, 0);

  // 目覚めビュー
  private wakeView = new Container();
  private wakeBg = new Graphics();
  private avatarWake = new PlayerAvatar();
  private textPanel = new Graphics();
  private wakeText = new Text({
    text: '',
    style: { fill: 0xffffff, fontSize: 21, lineHeight: 32, wordWrap: true, wordWrapWidth: 640 },
  });
  private advanceHint = new Text({
    text: '▼ タップ',
    style: { fill: 0xffe08a, fontSize: 15 },
  });
  private wakeLineIndex = 0;

  enter(manager: SceneManager): void {
    this.manager = manager;
    this.container.addChild(this.rootBg);
    this.container.addChild(this.barnView, this.povView, this.wakeView);
    this.container.addChild(this.fade, this.skipHint);
    this.fade.alpha = 0;
    this.povView.visible = false;
    this.wakeView.visible = false;
    this.skipHint.anchor.set(1, 0);
    this.skipHint.alpha = 0.7;

    this.container.eventMode = 'static';
    this.container.on('pointerdown', this.onTap);

    void this.load();
  }

  private async load(): Promise<void> {
    const [goatFront, goatRight] = await Promise.all([
      Assets.load<Texture>(goatFrontUrl),
      loadChromaKeyedTexture(goatRightUrl),
    ]);
    this.buildBarn(goatRight);
    this.buildPov(goatFront);
    this.buildWake();
    this.layout();
    this.ready = true;
  }

  private buildBarn(goatTex: Texture): void {
    this.goat = new Sprite(goatTex);
    this.goat.anchor.set(0.5, 1);
    this.noticeMark.anchor.set(0.5, 1);
    this.noticeMark.visible = false;
    this.plushBarn.view.scale.set(0.7);
    this.barnView.addChild(
      this.barnBg,
      this.plushBarn.view,
      this.avatarBarn.view,
      this.goat,
      this.noticeMark,
    );
  }

  private buildPov(faceTex: Texture): void {
    const sprite = new Sprite(faceTex);
    this.face.addChild(sprite);
    for (const [g, side] of [
      [this.nostrilL, -1],
      [this.nostrilR, 1],
    ] as const) {
      g.ellipse(0, 0, 11, 14).fill({ color: 0x2b0f14, alpha: 0.9 });
      g.position.set(NOSE_CENTER.x + NOSTRIL_OFFSET * side, NOSE_CENTER.y);
      this.face.addChild(g);
    }
    this.face.pivot.set(NOSE_CENTER.x, NOSE_CENTER.y);
    this.plushPov.view.scale.set(0.8);
    this.povView.addChild(
      this.povBg,
      this.face,
      this.particleLayer,
      this.plushPov.view,
      this.avatarPov.view,
    );

    for (let i = 0; i < 26; i++) {
      const g = new Graphics();
      if (i % 3 === 0) {
        g.circle(0, 0, 2 + Math.random() * 2).fill({ color: 0xcbb9a0, alpha: 0.8 });
      } else {
        g.rect(-7, -1.5, 14, 3).fill({ color: 0xd9b96a, alpha: 0.9 });
        g.rotation = Math.random() * Math.PI;
      }
      this.particleLayer.addChild(g);
      this.particles.push({ g, x: 0, y: 0, vx: 0, vy: 0 });
    }
    this.particleLayer.visible = false;
  }

  private buildWake(): void {
    this.advanceHint.anchor.set(1, 1);
    this.wakeView.addChild(this.wakeBg, this.avatarWake.view, this.textPanel, this.wakeText, this.advanceHint);
  }

  private onTap = (): void => {
    if (!this.ready) return;
    if (this.phase !== 'wake') {
      this.fade.alpha = 1;
      this.setPhase('wake');
      return;
    }
    this.wakeLineIndex++;
    if (this.wakeLineIndex >= WAKE_LINES.length) {
      if (this.starting) return;
      this.starting = true;
      void this.manager.goto(new GameScene());
      return;
    }
    this.applyWakeText();
  };

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTime = 0;
    this.barnView.visible = phase === 'barn' || phase === 'notice' || phase === 'approach';
    this.povView.visible = phase === 'pov' || phase === 'suction' || phase === 'blackout';
    this.wakeView.visible = phase === 'wake';
    this.particleLayer.visible = phase === 'suction' || phase === 'blackout';
    this.skipHint.visible = phase !== 'wake';
    if (phase === 'pov') this.fade.alpha = 1;
    if (phase === 'suction') this.initParticles();
    if (phase === 'wake') this.applyWakeText();
  }

  private applyWakeText(): void {
    this.wakeText.text = WAKE_LINES[this.wakeLineIndex];
    this.advanceHint.text = this.wakeLineIndex === WAKE_LINES.length - 1 ? '▼ タップで出発' : '▼ タップ';
  }

  private initParticles(): void {
    for (const p of this.particles) this.respawnParticle(p);
  }

  private respawnParticle(p: SuckParticle): void {
    const { w, h } = this.screen;
    const edge = Math.random();
    if (edge < 0.35) {
      p.x = -30;
      p.y = Math.random() * h;
    } else if (edge < 0.7) {
      p.x = w + 30;
      p.y = Math.random() * h;
    } else {
      p.x = Math.random() * w;
      p.y = h + 30;
    }
    p.vx = 0;
    p.vy = 0;
  }

  exit(): void {
    this.container.off('pointerdown', this.onTap);
  }

  update(dtSec: number): void {
    if (!this.ready) return;
    this.time += dtSec;
    this.phaseTime += dtSec;
    const P = PARAMS.prologue;
    const { w, h } = this.screen;
    const floorY = h * 0.78;
    const playerX = w * 0.26;

    switch (this.phase) {
      case 'barn':
      case 'notice':
      case 'approach': {
        this.updateBarn(dtSec, floorY, playerX);
        if (this.phase === 'barn' && this.phaseTime >= P.barnSec) {
          this.goatNoticeX = this.goatX;
          this.setPhase('notice');
        } else if (this.phase === 'notice' && this.phaseTime >= P.noticeSec) {
          this.setPhase('approach');
        } else if (this.phase === 'approach' && this.phaseTime >= P.approachSec) {
          this.setPhase('pov');
        }
        break;
      }
      case 'pov': {
        this.fade.alpha = Math.max(0, this.fade.alpha - dtSec / 0.4);
        this.updatePov(dtSec, Math.min(1, this.phaseTime / P.povSec), 0);
        if (this.phaseTime >= P.povSec) this.setPhase('suction');
        break;
      }
      case 'suction': {
        const t = Math.min(1, this.phaseTime / P.suctionSec);
        this.updatePov(dtSec, 1, t);
        if (this.phaseTime >= P.suctionSec) this.setPhase('blackout');
        break;
      }
      case 'blackout': {
        this.fade.alpha = Math.min(1, this.phaseTime / P.blackoutSec);
        this.updatePov(dtSec, 1, 1);
        if (this.phaseTime >= P.blackoutSec) this.setPhase('wake');
        break;
      }
      case 'wake': {
        this.fade.alpha = Math.max(0, this.fade.alpha - dtSec / 0.8);
        this.avatarWake.view.position.set(w / 2, h * 0.5);
        this.avatarWake.update(dtSec, {
          state: this.wakeLineIndex === 0 ? 'prone' : 'upright',
          grounded: true,
          hanging: false,
          vx: 0,
          vy: 0,
          facing: 1,
        });
        this.advanceHint.alpha = 0.6 + 0.4 * Math.sin(this.time * 4);
        break;
      }
    }
  }

  private updateBarn(dtSec: number, floorY: number, playerX: number): void {
    const { w, h } = this.screen;
    const P = PARAMS.prologue;

    // 主人公: 干し草の上でぬいぐるみを抱いてくつろぐ
    this.avatarBarn.view.position.set(playerX, floorY - 16);
    this.avatarBarn.update(dtSec, {
      state: 'prone',
      grounded: true,
      hanging: false,
      vx: 0,
      vy: 0,
      facing: 1,
    });
    this.plushBarn.view.position.set(playerX + 34, floorY - 20);
    this.plushBarn.update(dtSec, false);

    // ヤギの移動
    this.goatScale = (h * 0.55) / this.goat.texture.height;
    const sprW = this.goat.texture.width * this.goatScale;
    this.goatPrevX = this.goatX;
    if (this.phase === 'barn') {
      this.goatX = w * 0.72 + Math.sin(this.time * 0.7) * w * 0.1;
    } else if (this.phase === 'approach') {
      const target = playerX + 40 + sprW * 0.45;
      const t = easeInOut(Math.min(1, this.phaseTime / P.approachSec));
      this.goatX = this.goatNoticeX + (target - this.goatNoticeX) * t;
    }
    const moving = Math.abs(this.goatX - this.goatPrevX) > 0.1;
    const facingRight = this.goatX - this.goatPrevX > 0.1;
    const bob = moving ? Math.abs(Math.sin(this.time * 6)) * 5 : 0;
    this.goat.position.set(this.goatX, floorY + 8 - bob);
    this.goat.scale.set(facingRight ? -this.goatScale : this.goatScale, this.goatScale);
    this.goat.rotation = moving ? Math.sin(this.time * 6) * 0.02 : 0;

    // 気づきマーク
    this.noticeMark.visible = this.phase === 'notice';
    if (this.noticeMark.visible) {
      const headX = this.goatX - sprW * 0.38;
      const headY = floorY + 8 - this.goat.texture.height * this.goatScale;
      this.noticeMark.position.set(headX, headY - 6 - Math.abs(Math.sin(this.phaseTime * 8)) * 8);
    }
  }

  // approachT: 顔の接近進行度(0〜1) / suctionT: 吸い込み進行度(0〜1)
  private updatePov(dtSec: number, approachT: number, suctionT: number): void {
    const { w, h } = this.screen;

    const s0 = (h * 0.62) / HEAD_HEIGHT_PX;
    const s1 = (w * 0.55) / 140;
    const a = easeInOut(approachT);
    let scale = s0 + (s1 - s0) * a;
    scale *= 1 + suctionT * suctionT * 1.6;
    // 呼吸のゆらぎ
    scale *= 1 + 0.012 * Math.sin(this.time * 5);

    const noseX = w / 2;
    const noseY = h * 0.42 + a * h * 0.1;
    let shake = 0;
    if (suctionT > 0) shake = 10 * Math.min(1, suctionT * 3);
    this.face.position.set(
      noseX + (Math.random() - 0.5) * shake,
      noseY + (Math.random() - 0.5) * shake,
    );
    this.face.scale.set(scale);
    this.face.rotation = Math.sin(this.time * 1.3) * 0.015;

    // 鼻の穴の広がり(ボーン風に呼吸で伸縮)
    const flare = 1 + 0.15 * Math.sin(this.time * 5) + suctionT * 1.2;
    this.nostrilL.scale.set(flare, flare * 1.15);
    this.nostrilR.scale.set(flare, flare * 1.15);

    // ぬいぐるみ: 先に吸い込まれていく
    const plushT = Math.min(1, Math.max(0, (suctionT - 0.08) / 0.42));
    const pt = plushT * plushT;
    const plushHome = { x: w / 2 + 60, y: h * 0.9 };
    this.plushPov.view.visible = plushT < 1;
    this.plushPov.view.position.set(
      plushHome.x + (this.face.position.x - plushHome.x) * pt,
      plushHome.y + (this.face.position.y - plushHome.y) * pt,
    );
    this.plushPov.view.rotation = pt * Math.PI * 3;
    this.plushPov.view.scale.set(0.8 * (1 - pt * 0.6));
    this.plushPov.update(dtSec, false);

    // 主人公: 見かけサイズは保ったまま、最後に吸い込まれる
    const playerT = Math.min(1, Math.max(0, (suctionT - 0.35) / 0.6));
    const qt = playerT * playerT;
    const home = { x: w / 2, y: h * 0.92 };
    this.avatarPov.view.position.set(
      home.x + (this.face.position.x - home.x) * qt,
      home.y + (this.face.position.y - home.y) * qt,
    );
    this.avatarPov.view.rotation = qt * Math.PI * 2.5;
    this.avatarPov.view.scale.set(1 - qt * 0.55);
    this.avatarPov.update(dtSec, {
      state: 'upright',
      grounded: playerT <= 0,
      hanging: false,
      vx: suctionT > 0 ? 40 : 0,
      vy: playerT > 0 ? -200 : 0,
      facing: 1,
    });

    // 吸い込まれる干し草・ほこり
    if (this.particleLayer.visible) {
      for (const p of this.particles) {
        const dx = this.face.position.x - p.x;
        const dy = this.face.position.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 40) {
          this.respawnParticle(p);
          continue;
        }
        p.vx += (dx / dist) * 2600 * dtSec;
        p.vy += (dy / dist) * 2600 * dtSec;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.g.position.set(p.x, p.y);
        p.g.rotation += dtSec * 6;
      }
    }
  }

  private layout(): void {
    const { w, h } = this.screen;
    const floorY = h * 0.78;

    this.rootBg.clear();
    this.rootBg.rect(0, 0, w, h).fill(0x1a1216);

    this.fade.clear();
    this.fade.rect(0, 0, w, h).fill(0x000000);

    this.skipHint.position.set(w - 16, 12);

    // ヤギ舎の背景
    const g = this.barnBg;
    g.clear();
    g.rect(0, 0, w, floorY).fill(0x7a5a3a);
    const plankW = 90;
    for (let x = 0; x < w; x += plankW) {
      g.rect(x, 0, 3, floorY).fill(0x5e4429);
    }
    g.rect(0, h * 0.12, w, 8).fill(0x5e4429);
    g.rect(0, h * 0.45, w, 8).fill(0x5e4429);
    g.rect(0, floorY, w, h - floorY).fill(0x9a7c4e);
    g.ellipse(w * 0.28, floorY + 6, 130, 26).fill(0xd9b96a);
    g.ellipse(w * 0.2, floorY - 2, 70, 18).fill(0xe3c67e);
    g.ellipse(w * 0.34, floorY - 2, 80, 20).fill(0xcfae5f);
    g.ellipse(w * 0.8, floorY + 12, 110, 20).fill({ color: 0xd9b96a, alpha: 0.5 });

    // 主人公目線の背景(ぼんやりしたヤギ舎)
    const pb = this.povBg;
    pb.clear();
    pb.rect(0, 0, w, h * 0.6).fill(0x8a6f47);
    pb.rect(0, h * 0.6, w, h * 0.4).fill(0xa88b58);
    pb.ellipse(w / 2, h, w * 0.7, h * 0.25).fill(0xd9b96a);

    // 鼻の中(目覚め)の背景
    const wb = this.wakeBg;
    wb.clear();
    wb.rect(0, 0, w, h).fill(0x2a161c);
    wb.ellipse(w / 2, h * 0.5, w * 0.42, h * 0.42).fill(0x6e3641);
    wb.ellipse(w / 2, h * 0.52, w * 0.34, h * 0.33).fill(0x86424f);
    wb.moveTo(w * 0.2, h * 0.68);
    wb.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.8, h * 0.68);
    wb.stroke({ width: 4, color: 0x5a2430, alpha: 0.6 });

    // テキストパネル
    const panelW = Math.min(w * 0.82, 760);
    const panelH = h * 0.2;
    const panelX = (w - panelW) / 2;
    const panelY = h * 0.72;
    this.textPanel.clear();
    this.textPanel
      .roundRect(panelX, panelY, panelW, panelH, 12)
      .fill({ color: 0x000000, alpha: 0.55 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
    this.wakeText.style.wordWrapWidth = panelW - 48;
    this.wakeText.position.set(panelX + 24, panelY + 18);
    this.advanceHint.position.set(panelX + panelW - 16, panelY + panelH - 10);
  }

  resize(width: number, height: number): void {
    this.screen = { w: width, h: height };
    if (this.ready) this.layout();
    else {
      this.rootBg.clear();
      this.rootBg.rect(0, 0, width, height).fill(0x1a1216);
    }
  }
}
