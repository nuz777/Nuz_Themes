import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Playlist } from '../../services/tracks.service';

@Component({
  selector: 'app-playlist-card',
  imports: [RouterLink],
  templateUrl: './playlist-card.html',
})
export class PlaylistCard {
  readonly playlist = input.required<Playlist>();
}
