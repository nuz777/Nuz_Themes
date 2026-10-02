import { Component, input, output } from '@angular/core';
import type { Chapter } from '../../models/track';

@Component({
  selector: 'app-chapter-list',
  imports: [],
  templateUrl: './chapter-list.html',
  styles: [':host { display: block; }'],
})
export class ChapterList {
  readonly chapters = input<Chapter[]>([]);
  readonly activeIndex = input(-1);
  readonly horizontal = input(false);
  readonly select = output<number>();

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  protected chapterClasses(index: number): string {
    const base = 'flex items-center gap-2 text-left font-semibold transition';
    const layout = this.horizontal()
      ? 'shrink-0 rounded-full px-3 py-1.5 text-xs'
      : 'w-full rounded-lg px-2 py-2 text-sm';
    const tone =
      index === this.activeIndex()
        ? 'bg-white/15 text-white'
        : 'text-neutral-400 hover:bg-white/10 hover:text-neutral-200';
    return `${base} ${layout} ${tone}`;
  }
}
