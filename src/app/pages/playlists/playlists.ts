import { Component, inject } from '@angular/core';
import { TracksService } from '../../services/tracks.service';
import { PlaylistCard } from '../../components/playlist-card/playlist-card';

@Component({
  selector: 'app-playlists-page',
  imports: [PlaylistCard],
  templateUrl: './playlists.html',
})
export class PlaylistsPage {
  protected readonly tracksService = inject(TracksService);
}
