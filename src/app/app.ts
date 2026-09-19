import { Component, ElementRef, HostListener, inject, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { Sidebar } from './components/sidebar/sidebar';
import { PlayerBar } from './components/player-bar/player-bar';
import { NowPlaying } from './components/now-playing/now-playing';
import { Toast } from './components/toast/toast';
import { FavoritesFAB } from './components/favorites-fab/favorites-fab';
import { TracksService } from './services/tracks.service';
import { AudioService } from './services/audio.service';
import { MediaSessionService } from './services/media-session.service';

const BOOT_LOADER_ID = 'boot-loader';
const MIN_VISIBLE_MS = 900;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Sidebar, PlayerBar, NowPlaying, Toast, FavoritesFAB],
  templateUrl: './app.html',
})
export class App implements OnInit, OnDestroy {
  protected readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);
  private readonly mediaSession = inject(MediaSessionService);

  protected readonly sidebarOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly isFullscreen = signal(false);

  @ViewChild('sidebarWrapper') private sidebarWrapper?: ElementRef<HTMLElement>;
  @ViewChild('sidebarToggle') private sidebarToggle?: ElementRef<HTMLElement>;
  @ViewChild('headerMenuToggle') private headerMenuToggle?: ElementRef<HTMLElement>;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const inside = (ref?: ElementRef<HTMLElement>): boolean => !!ref?.nativeElement.contains(target);
    if (inside(this.sidebarWrapper)) return;
    if (inside(this.sidebarToggle)) return;
    if (inside(this.headerMenuToggle)) return;
    this.sidebarOpen.set(false);
    if (!this.sidebarCollapsed()) this.sidebarCollapsed.set(true);
  }

  private readonly routerSub = inject(Router).events.subscribe((event) => {
    if (event instanceof NavigationStart) {
      this.audio.closeNowPlaying();
      this.sidebarOpen.set(false);
    }
  });

  protected toggleFullscreen(): void {
    if (typeof document === 'undefined') return;

    const exit = (): void => {
      this.isFullscreen.set(false);
    };

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      exit();
      return;
    }

    const el = document.documentElement;
    const req = el.requestFullscreen();

    if (req && typeof req.then === 'function') {
      req.then(() => this.isFullscreen.set(true)).catch(() => {});
    } else {
      this.isFullscreen.set(true);
    }

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) exit();
    });
  }

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
