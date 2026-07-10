import { PARAMS } from '../config/params';

export interface CavePoint {
  x: number;
  y: number;
}

export interface CaveShape {
  length: number;
  floor: CavePoint[];
  ceiling: CavePoint[];
  centerYAt(x: number): number;
  radiusAt(x: number): number;
}

// 地形を毎回同じ形にするための固定シード付き乱数
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCave(seed = 20260711): CaveShape {
  const p = PARAMS.cave;
  const rand = mulberry32(seed);
  const ph1 = rand() * Math.PI * 2;
  const ph2 = rand() * Math.PI * 2;
  const ph3 = rand() * Math.PI * 2;
  const ph4 = rand() * Math.PI * 2;

  const centerYAt = (x: number): number => {
    const s = Math.max(0, Math.min(p.length, x));
    // 入り口付近は蛇行を弱めて水平に近づける
    const fadeIn = Math.min(1, s / (p.wiggleWavelength * 0.5));
    const w1 = Math.sin((s / p.wiggleWavelength) * Math.PI * 2 + ph1) * 0.65;
    const w2 = Math.sin((s / (p.wiggleWavelength * 0.53)) * Math.PI * 2 + ph2) * 0.35;
    return p.wiggleAmplitude * (w1 + w2) * fadeIn;
  };

  const radiusAt = (x: number): number => {
    const s = Math.max(0, Math.min(p.length, x));
    const v1 = Math.sin((s / (p.wiggleWavelength * 0.81)) * Math.PI * 2 + ph3) * 0.6;
    const v2 = Math.sin((s / (p.wiggleWavelength * 0.29)) * Math.PI * 2 + ph4) * 0.4;
    let r = p.radiusAvg * (1 + p.radiusVariation * (v1 + v2));
    // 鼻の穴の入り口は少し開いている
    r *= 1 + 0.5 * Math.exp(-s / 200);
    // 最奥はすぼまる(ぬいぐるみが挟まる場所)
    const tail = (p.length - s) / 300;
    if (tail < 1) r *= 0.55 + 0.45 * tail;
    return r;
  };

  const floor: CavePoint[] = [];
  const ceiling: CavePoint[] = [];
  const steps = Math.ceil(p.length / p.segmentLength);
  for (let i = 0; i <= steps; i++) {
    const x = Math.min(p.length, i * p.segmentLength);
    const cy = centerYAt(x);
    const r = radiusAt(x);
    floor.push({ x, y: cy + r });
    ceiling.push({ x, y: cy - r });
  }

  return { length: p.length, floor, ceiling, centerYAt, radiusAt };
}
