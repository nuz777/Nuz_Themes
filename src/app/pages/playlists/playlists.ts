import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TracksService } from '../../services/tracks.service';
import { PlaylistCard } from '../../components/playlist-card/playlist-card';

@Component({
  selector: 'app-playlists-page',
  imports: [PlaylistCard],
  templateUrl: './playlists.html',
})
export class PlaylistsPage {
  protected readonly tracksService = inject(TracksService);
  private readonly router = inject(Router);
  protected readonly creating = signal(false);

  protected createPlaylist(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem('playlistName');
    if (!(input instanceof HTMLInputElement)) return;

    const playlist = this.tracksService.createPlaylist(input.value);
    if (!playlist) return;
    this.creating.set(false);
    void this.router.navigate(['/playlist', playlist.id]);
  }
}
