import { Texture } from 'pixi.js';

// 緑背景(クロマキー)の画像を透過テクスチャとして読み込む
export async function loadChromaKeyedTexture(url: string): Promise<Texture> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (g > 80 && g > r * 1.25 && g > b * 1.25) {
      d[i + 3] = 0;
    } else if (g > Math.max(r, b)) {
      // 輪郭の緑かぶりを抑える
      d[i + 1] = Math.max(r, b);
    }
  }
  ctx.putImageData(data, 0, 0);
  return Texture.from(canvas);
}
