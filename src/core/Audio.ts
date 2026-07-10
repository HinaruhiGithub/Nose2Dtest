import sneeze1Url from '../../referenceAssets/sounds/sneeze1.wav';
import sneeze2Url from '../../referenceAssets/sounds/sneeze2.wav';
import sneeze3Url from '../../referenceAssets/sounds/sneeze3.wav';
import sneezeLastUrl from '../../referenceAssets/sounds/sneeze_last.wav';

const breathUrls = [sneeze1Url, sneeze2Url, sneeze3Url];

function play(url: string): void {
  const audio = new Audio(url);
  // ブラウザの自動再生制限で失敗しても無視する
  void audio.play().catch(() => {});
}

export function playBreath(index: number): void {
  const url = breathUrls[Math.max(0, Math.min(breathUrls.length - 1, index))];
  play(url);
}

export function playBigSneeze(): void {
  play(sneezeLastUrl);
}
