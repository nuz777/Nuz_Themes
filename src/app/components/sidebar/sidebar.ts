import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import type { Playlist } from '../../services/tracks.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  host: { class: 'block h-full min-h-0' },
})
export class Sidebar {
  readonly playlists = input<Playlist[]>([]);
}
