// ゲームバランス調整用パラメータ集。
// このファイルの値はユーザが直接調整する。AIは値を勝手に元へ戻さないこと。
// 単位: 長さ=px(ワールド座標) / 時間=秒 / 角度=ラジアン / メーター=0〜1

export const PARAMS = {
  world: {
    // 重力の強さ(Matter.js標準は1.0)
    gravityY: 1.0,
  },

  cave: {
    // 鼻の入り口から奥(耳の位置)までの長さ
    length: 6000,
    // チューブ半径の平均(主人公の身長よりわずかに大きい程度)
    radiusAvg: 80,
    // 半径の変動割合(0.25なら±25%)
    radiusVariation: 0.25,
    // 上下の蛇行の振幅
    wiggleAmplitude: 130,
    // 蛇行の波長
    wiggleWavelength: 1100,
    // 地形を分割するセグメント1つの長さ(細かいほど滑らか・重い)
    segmentLength: 50,
    // 壁の弾力(反発係数 0〜1)
    wallRestitution: 0.4,
    // 壁の柔らかさの見た目の押し込み量(描画上のへこみ)
    wallSquishVisual: 10,
  },

  player: {
    // 主人公の身長(直立時)
    height: 64,
    // 直立時の横幅
    width: 24,
    // 直立時の左右移動速度
    walkSpeedUpright: 260,
    // うつ伏せ時の左右移動速度
    walkSpeedProne: 110,
    // ジャンプの初速(天井にぎりぎりぶつからない程度に調整する)
    jumpVelocity: 420,
    // 空中での左右移動の効き(1で地上と同じ)
    airControl: 0.6,
    // 鼻毛に掴まれる距離
    grabRange: 70,
  },

  tickle: {
    // くすぐりメーターの自然減少速度(毎秒)
    decayPerSec: 0.03,
    // 直立で1px歩くごとの増加量
    walkUprightPerPx: 0.00006,
    // うつ伏せで1px動くごとの増加量
    walkPronePerPx: 0.00035,
    // 壁・天井への衝突1回あたりの増加量(衝突速度に比例して加算)
    bumpBase: 0.02,
    bumpPerSpeed: 0.0002,
  },

  noseHair: {
    // 鼻毛の生える間隔(おおよそ)
    spacing: 320,
    // 間隔のランダムゆらぎ
    spacingJitter: 80,
    // 鼻毛の長さ(主人公と同程度)
    length: 64,
    // 掴まり中の耐久減少速度(毎秒、静止時)
    drainPerSec: 0.08,
    // 主人公の速度に比例した追加減少(速度1px/sあたり毎秒)
    drainPerSpeed: 0.0006,
    // 抜けてから再生するまでの時間
    regrowSec: 12,
    // ばねの硬さ(なびき)
    stiffness: 0.06,
    // ばねの減衰
    damping: 0.9,
  },

  sneeze: {
    // 短い呼吸の回数
    breathCount: 3,
    // 呼吸1回ごとの間隔
    breathIntervalSec: 0.55,
    // 呼吸1回ごとに顔が上を向く角度
    breathAngleStep: 0.06,
    // 大くしゃみで主人公に加わる入り口方向の速度
    blowSpeed: 1400,
    // 大くしゃみ後にメーター運用を再開するまでの時間
    recoverSec: 1.0,
  },

  goat: {
    // 通常時の呼吸による顔角度のゆらぎ(振幅)
    idleBreathAngle: 0.02,
    // 通常時の呼吸の周期
    idleBreathPeriodSec: 3.5,
  },

  plush: {
    // ぬいぐるみの耐久が満タンからゼロになるまでの引き抜き時間
    pullDurationSec: 6,
    // 引き抜き中のくすぐりメーター上昇速度(毎秒)
    tickleRisePerSec: 0.12,
    // 引き抜き操作が可能になる距離
    grabRange: 90,
  },

  camera: {
    // カメラの追従の滑らかさ(大きいほど機敏)
    followLerp: 5,
    // ゲーム本編のズーム倍率
    zoom: 1.0,
  },
} as const;

export type Params = typeof PARAMS;
