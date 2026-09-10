import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { Sidebar } from './components/sidebar/sidebar';
import { PlayerBar } from './components/player-bar/player-bar';
import { NowPlaying } from './components/now-playing/now-playing';
import { Toast } from './components/toast/toast';
import { TracksService } from './services/tracks.service';
import { AudioService } from './services/audio.service';

const BOOT_LOADER_ID = 'boot-loader';
const MIN_VISIBLE_MS = 900;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Sidebar, PlayerBar, NowPlaying, Toast],
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);

  protected readonly sidebarOpen = signal(false);

  private readonly routerSub = inject(Router).events.subscribe((event) => {
    if (event instanceof NavigationStart) {
      this.audio.closeNowPlaying();
      this.sidebarOpen.set(false);
    }
  });

  ngOnInit(): void {
    this.hideBootLoader();
  }

  private hideBootLoader(): void {
    if (typeof document === 'undefined') return;

    const loader = document.getElementById(BOOT_LOADER_ID);
    if (!loader) return;

    const age = performance.now();
    const wait = Math.max(0, MIN_VISIBLE_MS - age);

    setTimeout(() => {
      loader.classList.add('is-hidden');
      setTimeout(() => loader.remove(), 500);
    }, wait);
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }
}
