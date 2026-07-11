import { Container, Graphics, Sprite } from 'pixi.js';
import goatRightUrl from '../../referenceAssets/images/goatRight.png';
import { PARAMS } from '../config/params';
import { loadChromaKeyedTexture } from '../core/TextureUtils';

// goatRight.png 上の部位座標(テクスチャpx)
const NOSE_TIP = { x: 72, y: 648 };
const EAR_BELOW = { x: 400, y: 720 };

// ゲーム本編の背景。goatRight の顔を拡大して置き、
// プレイヤーの進行(鼻先→耳下)に合わせてパララックス移動させる。
export class GoatBackdrop {
  readonly view = new Container();
  private bg = new Graphics();
  private goat: Sprite | null = null;
  private screen = { w: 960, h: 540 };

  constructor(private caveLength: number) {
    this.view.addChild(this.bg);
    void loadChromaKeyedTexture(goatRightUrl).then((tex) => {
      this.goat = new Sprite(tex);
      // 奥にあるように少しだけ色を沈める
      this.goat.tint = 0xdfc2c7;
      this.goat.alpha = PARAMS.backdrop.alpha;
      this.view.addChild(this.goat);
    });
  }

  update(cameraX: number, faceAngle: number, timeSec: number): void {
    const goat = this.goat;
    if (!goat) return;
    const p = PARAMS.backdrop;
    const t = Math.max(0, Math.min(1, cameraX / this.caveLength));
    goat.pivot.set(
      NOSE_TIP.x + (EAR_BELOW.x - NOSE_TIP.x) * t,
      NOSE_TIP.y + (EAR_BELOW.y - NOSE_TIP.y) * t,
    );
    goat.position.set(this.screen.w / 2, this.screen.h / 2 + p.yOffset);
    goat.rotation = faceAngle;
    const breath = Math.sin((timeSec / PARAMS.goat.idleBreathPeriodSec) * Math.PI * 2);
    goat.scale.set(p.scale * (1 + breath * 0.01));
  }

  resize(width: number, height: number): void {
    this.screen = { w: width, h: height };
    this.bg.clear();
    this.bg.rect(0, 0, width, height).fill(0x231016);
    this.bg
      .ellipse(width / 2, height / 2, width * 0.7, height * 0.55)
      .fill({ color: 0x321820, alpha: 0.8 });
  }
}
