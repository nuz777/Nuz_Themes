import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { DurationService } from '../../services/duration.service';
import { ToastService } from '../../services/toast.service';
import type { Track } from '../../models/track';

@Component({
  selector: 'app-live-playlist',
  imports: [],
  templateUrl: './live-playlist.html',
})
export class LivePlaylist {
  readonly embedded = input<boolean>(false);

  @ViewChild('listContainer') private listContainer?: ElementRef<HTMLElement>;

  protected readonly audio = inject(AudioService);
  private readonly durations = inject(DurationService);
  private readonly toast = inject(ToastService);

  protected readonly queue = computed(() => this.audio.queue());
  protected readonly currentIndex = computed(() => this.audio.queueIndex());
  protected readonly queueTitle = computed(() => this.audio.queueTitle());

  protected readonly totalDuration = computed(() => {
    const q = this.queue();
    return q.reduce((acc, t) => acc + (t.duration || this.durations.durationOf(t.id) || 0), 0);
  });

  constructor() {
    effect(() => {
      const idx = this.currentIndex();
      if (idx < 0) return;
      // Auto-scroll suave para mantener la pista activa siempre a la vista
      requestAnimationFrame(() => {
        const activeEl = this.listContainer?.nativeElement.querySelector(`[data-queue-idx="${idx}"]`);
        activeEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  protected durationOf(track: Track): number {
    return track.duration || this.durations.durationOf(track.id) || 0;
  }

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  protected formattedTotalDuration(): string {
    const total = this.totalDuration();
    if (!total || total <= 0) return '';
    const m = Math.floor(total / 60);
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h} h ${remM} min`;
    }
    return `${m} min`;
  }

  protected onTrackClick(index: number): void {
    this.audio.playQueueIndex(index);
  }

  protected onRemoveTrack(index: number, event: Event): void {
    event.stopPropagation();
    const q = this.queue();
    const removedTrack = q[index];
    this.audio.removeFromQueue(index);
    if (removedTrack) {
      this.toast.show(`Quitada de la lista: ${removedTrack.title}`, 'info');
    }
  }

  protected onClearQueue(): void {
    this.audio.clearQueue();
    this.toast.show('Cola de reproducción vaciada', 'info');
  }
}
