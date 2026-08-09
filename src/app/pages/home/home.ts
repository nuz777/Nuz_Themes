import { Component, inject } from '@angular/core';
import { TracksService } from '../../services/tracks.service';
import { PlaylistCard } from '../../components/playlist-card/playlist-card';

@Component({
  selector: 'app-home',
  imports: [PlaylistCard],
  templateUrl: './home.html',
})
export class Home {
  protected readonly tracksService = inject(TracksService);
}
