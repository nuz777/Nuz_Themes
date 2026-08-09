import { Component, effect, ElementRef, input } from '@angular/core';
import type { LyricLine } from '../../services/lyrics.service';

@Component({
  selector: 'app-lyrics-panel',
  imports: [],
  templateUrl: './lyrics-panel.html',
  styles: [':host { display: block; }'],
})
export class LyricsPanel {
  readonly lines = input<LyricLine[] | null>(null);
  readonly activeIndex = input(-1);
  readonly loading = input(false);
  readonly error = input(false);

  constructor(private readonly element: ElementRef<HTMLElement>) {
    effect(() => {
      const index = this.activeIndex();
      if (index < 0) return;

      const target = this.element.nativeElement.querySelector(
        `[data-line="${index}"]`,
      );
      if (!(target instanceof HTMLElement)) return;

      const container = findScrollParent(target) ?? this.element.nativeElement;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const desired = container.scrollTop + (targetRect.top - containerRect.top) - container.clientHeight * 0.3;

      if (Math.abs(container.scrollTop - desired) > 8) {
        container.scrollTo({ top: desired, behavior: 'smooth' });
      }
    });
  }
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}
