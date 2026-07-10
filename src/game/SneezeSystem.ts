import { PARAMS } from '../config/params';
import { playBigSneeze, playBreath } from '../core/Audio';

export type GoatPhase = 'idle' | 'breathing' | 'sneezing' | 'recover';

// ヤギのくすぐりメーターとくしゃみシーケンスの状態機械
export class SneezeSystem {
  meter = 0;
  phase: GoatPhase = 'idle';
  // くしゃみの瞬間に1度だけtrueになる(GameSceneが消費して主人公を吹き飛ばす)
  blowFired = false;
  // 鼻毛をなびかせる風(入り口方向が負)
  windX = 0;

  private timer = 0;
  private breathIndex = 0;
  private angleOffset = 0;
  private angleTarget = 0;
  // クリア演出用: 大きめのくしゃみ倍率
  private bigScale = 1;

  addTickle(amount: number): void {
    if (this.phase !== 'idle') return;
    this.meter = Math.min(1, this.meter + amount);
    if (this.meter >= 1) this.startBreathing();
  }

  fillTickle(): void {
    if (this.phase !== 'idle') return;
    this.meter = 1;
    this.startBreathing();
  }

  // クリア演出などで即座にくしゃみを起こす
  forceSneeze(bigScale = 1): void {
    this.bigScale = bigScale;
    this.meter = 1;
    this.startBreathing();
  }

  private startBreathing(): void {
    this.phase = 'breathing';
    this.breathIndex = 0;
    this.timer = 0;
  }

  update(dtSec: number): void {
    const p = PARAMS.sneeze;
    this.windX *= Math.pow(0.02, dtSec);
    if (Math.abs(this.windX) < 0.01) this.windX = 0;

    switch (this.phase) {
      case 'idle': {
        this.meter = Math.max(0, this.meter - PARAMS.tickle.decayPerSec * dtSec);
        this.angleTarget = 0;
        break;
      }
      case 'breathing': {
        this.timer -= dtSec;
        if (this.timer <= 0 && this.breathIndex < p.breathCount) {
          playBreath(this.breathIndex);
          this.breathIndex += 1;
          this.angleTarget = this.breathIndex * p.breathAngleStep;
          this.timer = p.breathIntervalSec;
        } else if (this.breathIndex >= p.breathCount && this.timer <= 0) {
          this.phase = 'sneezing';
          this.timer = 0.35;
          this.meter = 0;
          this.angleTarget = 0;
          this.blowFired = true;
          this.windX = -3.5 * this.bigScale;
          playBigSneeze();
        }
        break;
      }
      case 'sneezing': {
        this.timer -= dtSec;
        if (this.timer <= 0) {
          this.phase = 'recover';
          this.timer = p.recoverSec;
        }
        break;
      }
      case 'recover': {
        this.timer -= dtSec;
        if (this.timer <= 0) {
          this.phase = 'idle';
          this.bigScale = 1;
        }
        break;
      }
    }

    // 呼吸ではゆっくり上がり、くしゃみでは素早く戻る
    const rate = this.phase === 'sneezing' ? 18 : 6;
    this.angleOffset += (this.angleTarget - this.angleOffset) * Math.min(1, rate * dtSec);
  }

  faceAngle(timeSec: number): number {
    const g = PARAMS.goat;
    const idle =
      g.idleBreathAngle * Math.sin((timeSec / g.idleBreathPeriodSec) * Math.PI * 2);
    return idle + this.angleOffset;
  }

  // くしゃみ中のカメラ振動の強さ(0〜1)
  get shakeIntensity(): number {
    if (this.phase === 'sneezing') return 1;
    if (this.phase === 'breathing') return 0.25;
    return 0;
  }

  get blowSpeed(): number {
    return PARAMS.sneeze.blowSpeed * this.bigScale;
  }
}
