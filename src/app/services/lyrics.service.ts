import { Injectable } from '@angular/core';

export interface LyricLine {
  time: number;
  end?: number;
  text: string;
}

const TAG_RE = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

function parseLyrics(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const row of raw.split('\n')) {
    const line = row.trim();
    if (!line) continue;

    const matches = [...line.matchAll(TAG_RE)];
    if (!matches.length) continue;

    const text = line.slice(line.lastIndexOf(']') + 1).trim();
    if (!text) continue;

    const times = matches.map((m) => {
      const fraction = parseFloat('0.' + (m[3] ?? '0')) || 0;
      return Number(m[1]) * 60 + Number(m[2]) + fraction;
    });

    if (times.length === 1) {
      lines.push({ time: times[0], text });
    } else {
      times.sort((a, b) => a - b);
      lines.push({ time: times[0], end: times[times.length - 1], text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

@Injectable({ providedIn: 'root' })
export class LyricsService {
  private cache = new Map<string, LyricLine[]>();

  async get(url: string): Promise<LyricLine[]> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lyrics fetch failed: ${res.status}`);
    const text = await res.text();

    const lines = parseLyrics(text);
    this.cache.set(url, lines);
    return lines;
  }
}
