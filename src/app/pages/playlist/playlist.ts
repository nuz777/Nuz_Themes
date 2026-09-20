import { Component, inject, input, computed, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AudioService } from '../../services/audio.service';
import { TracksService } from '../../services/tracks.service';
import { TrackList } from '../../components/track-list/track-list';

const ROTATE_MS = 3500;

@Component({
  selector: 'app-playlist-page',
  imports: [TrackList],
  templateUrl: './playlist.html',
})
export class PlaylistPage implements OnDestroy {
  readonly id = input.required<string>();
  protected readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);
  private readonly router = inject(Router);
  protected readonly deleteConfirmOpen = signal(false);

  protected readonly playlist = computed(() => this.tracksService.getPlaylist(this.id()));
  protected readonly tracks = computed(() => this.tracksService.getPlaylistTracks(this.id()));

  protected readonly covers = computed(() => {
    const covers = this.tracks().map((t) => t.cover);
    const fallback = this.playlist()?.cover;
    return covers.length ? covers : fallback ? [fallback] : [];
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

  protected playAll(): void {
    this.audio.playQueue(this.tracks());
  }

  protected requestDeletePlaylist(): void {
    const current = this.playlist();
    if (!current?.userCreated) return;
    this.deleteConfirmOpen.set(true);
  }

  protected cancelDeletePlaylist(): void {
    this.deleteConfirmOpen.set(false);
  }

  protected confirmDeletePlaylist(): void {
    const current = this.playlist();
    if (!current?.userCreated) return;

    this.tracksService.deletePlaylist(current.id);
    this.deleteConfirmOpen.set(false);
    void this.router.navigate(['/playlists']);
  }
}
