import { Injectable, signal, computed } from '@angular/core';
import type { Track } from '../models/track';

const STORAGE_KEY = 'nuz-favorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly ids = signal<Set<string>>(this.load());

  readonly count = computed(() => this.ids().size);

  isFavorite(trackId: string): boolean {
    return this.ids().has(trackId);
  }

  toggle(track: Track): void {
    const next = new Set(this.ids());
    if (next.has(track.id)) {
      next.delete(track.id);
    } else {
      next.add(track.id);
    }
    this.ids.set(next);
    this.persist(next);
  }

  private load(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  private persist(ids: Set<string>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {}
  }
}
