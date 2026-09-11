import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TracksService, type Playlist } from '../../services/tracks.service';

const ROTATE_MS = 3500;

@Component({
  selector: 'app-playlist-card',
  imports: [RouterLink],
  templateUrl: './playlist-card.html',
})
export class PlaylistCard implements OnDestroy {
  readonly playlist = input.required<Playlist>();
  private readonly tracksService = inject(TracksService);

  protected readonly covers = computed(() => {
    const covers = this.playlist()
      .trackIds.map((id) => this.tracksService.getTrack(id)?.cover)
      .filter((c): c is string => !!c);
    return covers.length ? covers : [this.playlist().cover];
  });

  protected readonly activeIndex = signal(0);
  private readonly timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    this.timer = setInterval(() => {
      const covers = this.covers();
      if (covers.length < 2) return;
      this.activeIndex.update((i) => (i + 1) % covers.length);
    }, ROTATE_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}