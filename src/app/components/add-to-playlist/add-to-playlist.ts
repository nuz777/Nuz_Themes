import { Component, computed, inject, input, signal } from '@angular/core';
import { TracksService } from '../../services/tracks.service';
import { ToastService } from '../../services/toast.service';
import type { Track } from '../../models/track';

@Component({
  selector: 'app-add-to-playlist',
  imports: [],
  templateUrl: './add-to-playlist.html',
})
export class AddToPlaylist {
  readonly track = input.required<Track>();
  private readonly tracksService = inject(TracksService);
  private readonly toast = inject(ToastService);

  protected readonly open = signal(false);
  protected readonly userPlaylists = computed(() => this.tracksService.getUserPlaylists());

  protected toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.open.set(false);
  }

  protected addToPlaylist(playlistId: string, event: Event): void {
    event.stopPropagation();
    const playlist = this.tracksService.getPlaylist(playlistId);
    if (!playlist) return;
    const added = this.tracksService.addTrackToPlaylist(playlistId, this.track().id);
    if (added) {
      this.toast.show(`Guardado en "${playlist.name}"`, 'success', this.track().cover, 'Playlist actualizada');
    }
    this.open.set(false);
  }

  protected isInPlaylist(trackIds: string[]): boolean {
    return trackIds.includes(this.track().id);
  }

  protected createPlaylist(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem('playlistName');
    if (!(input instanceof HTMLInputElement)) return;

    const playlist = this.tracksService.createPlaylist(input.value);
    if (!playlist) return;
    this.tracksService.addTrackToPlaylist(playlist.id, this.track().id);
    this.toast.show(`Guardado en "${playlist.name}"`, 'success', this.track().cover, 'Playlist creada');
    this.open.set(false);
  }
}
