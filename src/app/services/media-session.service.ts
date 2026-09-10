import { Injectable, inject, effect } from '@angular/core';
import { AudioService } from './audio.service';

@Injectable({ providedIn: 'root' })
export class MediaSessionService {
  private readonly audio = inject(AudioService);

  private get session(): MediaSession | null {
    if (typeof navigator === 'undefined') return null;
    return navigator.mediaSession ?? null;
  }

  constructor() {
    this.registerHandlers();

    effect(() => {
      const track = this.audio.currentTrack();
      this.updateMetadata(track);
    });

    effect(() => {
      this.updatePlaybackState(this.audio.isPlaying());
    });
  }

  private updateMetadata(
    track: { title: string; artist: string; album: string; cover: string } | null,
  ): void {
    const session = this.session;
    if (!session || typeof MediaMetadata === 'undefined') return;

    session.metadata = track
      ? new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: Array.from({ length: 5 }, (_, i) => {
            const size = [96, 128, 192, 256, 512][i];
            return { src: track.cover, sizes: `${size}x${size}`, type: 'image/webp' };
          }),
        })
      : null;
  }

  private registerHandlers(): void {
    const session = this.session;
    if (!session) return;

    session.setActionHandler('play', () => {
      void this.audio.togglePlay();
    });
    session.setActionHandler('pause', () => {
      void this.audio.togglePlay();
    });
    session.setActionHandler('previoustrack', () => this.audio.prev());
    session.setActionHandler('nexttrack', () => this.audio.next());
    session.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) this.audio.seek(details.seekTime);
    });
    session.setActionHandler('seekbackward', () => {
      this.audio.seek(Math.max(0, this.audio.currentTime() - 10));
    });
    session.setActionHandler('seekforward', () => {
      const duration = this.audio.duration();
      this.audio.seek(Math.min(duration || 0, this.audio.currentTime() + 10));
    });
  }

  private updatePlaybackState(isPlaying: boolean): void {
    const session = this.session;
    if (!session || !MediaSession || !this.audio.currentTrack()) return;
    session.playbackState = isPlaying ? 'playing' : 'paused';
  }
}