import { Component, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { Sidebar } from './components/sidebar/sidebar';
import { PlayerBar } from './components/player-bar/player-bar';
import { NowPlaying } from './components/now-playing/now-playing';
import { TracksService } from './services/tracks.service';
import { AudioService } from './services/audio.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Sidebar, PlayerBar, NowPlaying],
  templateUrl: './app.html',
})
export class App implements OnDestroy {
  protected readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);

  protected readonly sidebarOpen = signal(false);

  private readonly routerSub = inject(Router).events.subscribe((event) => {
    if (event instanceof NavigationStart) {
      this.audio.closeNowPlaying();
      this.sidebarOpen.set(false);
    }
  });

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }
}
