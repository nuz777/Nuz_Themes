import { Injectable } from '@angular/core';
import type { Track } from '../models/track';

@Injectable({ providedIn: 'root' })
export class CoverCacheService {
  private readonly cached = new Set<string>();

  get isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * Pre-carga imágenes en la caché de memoria del navegador.
   * Con 'high', se solicitan inmediatamente para elementos visibles.
   * Con 'idle', se programan progresivamente sin competir con la reproducción ni la red principal.
   */
  preload(urls: (string | undefined | null)[], priority: 'high' | 'idle' = 'idle'): void {
    if (!this.isBrowser) return;

    const validUrls = urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0 && !this.cached.has(u));
    if (!validUrls.length) return;

    if (priority === 'high') {
      for (const url of validUrls) {
        this.loadImage(url);
      }
    } else {
      this.scheduleIdle(validUrls);
    }
  }

  /**
   * Pre-carga automáticamente las carátulas de las próximas canciones en la cola.
   */
  preloadQueue(currentTrack: Track | null, playlist: Track[]): void {
    if (!this.isBrowser || !currentTrack || !playlist.length) return;

    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    if (currentIndex === -1) return;

    const upcomingCovers: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentIndex + i) % playlist.length;
      const track = playlist[nextIndex];
      if (track?.cover) {
        upcomingCovers.push(track.cover);
      }
    }

    this.preload(upcomingCovers, 'high');
  }

  isCached(url: string): boolean {
    return this.cached.has(url);
  }

  private loadImage(url: string): void {
    if (this.cached.has(url)) return;
    this.cached.add(url);

    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    } catch {
      // Ignorar fallos silenciosos de pre-carga
    }
  }

  private scheduleIdle(urls: string[]): void {
    const queue = [...urls];

    const processBatch = (): void => {
      const batch = queue.splice(0, 4);
      for (const url of batch) {
        this.loadImage(url);
      }
      if (queue.length > 0) {
        if ('requestIdleCallback' in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(processBatch);
        } else {
          setTimeout(processBatch, 80);
        }
      }
    };

    if ('requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(processBatch);
    } else {
      setTimeout(processBatch, 80);
    }
  }
}
