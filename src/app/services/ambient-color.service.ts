import { Injectable } from '@angular/core';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

@Injectable({ providedIn: 'root' })
export class AmbientColorService {
  private readonly cache = new Map<string, string>();
  private readonly colorCache = new Map<string, string>();
  private readonly fallback =
    'linear-gradient(180deg, #181818 0%, #101010 55%, #000000 100%)';

  get isBrowser(): boolean {
    return typeof document !== 'undefined' && typeof document.createElement === 'function';
  }

  async getGradient(imageUrl: string): Promise<string> {
    const cached = this.cache.get(imageUrl);
    if (cached) return cached;

    const color = await this.analyze(imageUrl);
    if (!color || this.saturation(color) < 0.15) {
      this.cache.set(imageUrl, this.fallback);
      return this.fallback;
    }

    const dark = this.darken(color, 0.25);
    const gradient = `linear-gradient(180deg, ${this.hex(color)} 0%, ${this.hex(
      dark,
    )} 55%, #000000 100%)`;

    this.cache.set(imageUrl, gradient);
    return gradient;
  }

  async getColor(imageUrl: string): Promise<string> {
    const cached = this.colorCache.get(imageUrl);
    if (cached) return cached;

    const color = await this.analyze(imageUrl);
    const hex = color ? this.hex(color) : '#ffffff';
    this.colorCache.set(imageUrl, hex);
    return hex;
  }

  private async analyze(imageUrl: string): Promise<Rgb | null> {
    if (!this.isBrowser) return null;

    const image = new Image();
    image.crossOrigin = 'anonymous';

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('image load failed'));
        image.src = imageUrl;
      });

      const size = 24;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(image, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);

      const buckets = new Map<string, { count: number; rgb: Rgb }>();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r + g + b < 60) continue;

        const key = `${r >> 5},${g >> 5},${b >> 5}`;
        const entry = buckets.get(key);
        if (entry) {
          entry.count++;
          entry.rgb.r += r;
          entry.rgb.g += g;
          entry.rgb.b += b;
        } else {
          buckets.set(key, { count: 1, rgb: { r, g, b } });
        }
      }

      if (!buckets.size) return null;

      const colors = [...buckets.entries()]
        .map(([, { count, rgb }]) => ({
          count,
          avg: {
            r: Math.round(rgb.r / count),
            g: Math.round(rgb.g / count),
            b: Math.round(rgb.b / count),
          },
        }))
        .sort((a, b) => b.count - a.count);

      const top = colors.slice(0, Math.min(5, colors.length));
      const vibrant = top.reduce<{ count: number; avg: Rgb; s: number }>(
        (best, c) => {
          const s = this.saturation(c.avg);
          return s > best.s ? { ...c, s } : best;
        },
        { ...top[0], s: 0 },
      );

      return vibrant.s < 0.15 ? null : vibrant.avg;
    } catch {
      return null;
    }
  }

  private saturation({ r, g, b }: Rgb): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
  }

  private darken({ r, g, b }: Rgb, factor: number): Rgb {
    return {
      r: Math.round(r * factor),
      g: Math.round(g * factor),
      b: Math.round(b * factor),
    };
  }

  private hex({ r, g, b }: Rgb): string {
    const to = (v: number) => v.toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  }
}
