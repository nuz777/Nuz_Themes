import { Component, inject, signal, computed } from '@angular/core';
import { FavoritesService } from '../../services/favorites.service';
import { TracksService } from '../../services/tracks.service';
import { AudioService } from '../../services/audio.service';
import type { Track } from '../../models/track';
import { DurationService } from '../../services/duration.service';

const FAB_SIZE = 48;

@Component({
  selector: 'app-favorites-fab',
  imports: [],
  templateUrl: './favorites-fab.html',
})
export class FavoritesFAB {
  protected readonly favorites = inject(FavoritesService);
  private readonly tracksService = inject(TracksService);
  protected readonly audio = inject(AudioService);
  protected readonly durationService = inject(DurationService);
  protected readonly open = signal(false);

  protected readonly pos = signal<{ x: number; y: number } | null>(null);
  protected readonly panelPos = signal<{ left: number; top: number | null; bottom: number | null } | null>(null);
  private dragStart: { px: number; py: number; sx: number; sy: number } | null = null;
  private dragged = false;

  protected readonly tracks = computed(() => {
    const ids = [...this.favorites.ids()];
    return ids
      .map((id) => this.tracksService.getTrack(id))
      .filter((t): t is Track => t != null);
  });

  constructor() {
    this.durationService.preload(this.tracks().map((t) => ({ id: t.id, audioUrl: t.audioUrl })));
  }

  protected toggle(): void {
    this.open.set(!this.open());
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onFabPointerDown(event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    const start = this.pos();
    const rect = el.getBoundingClientRect();
    this.dragStart = {
      px: event.clientX,
      py: event.clientY,
      sx: start?.x ?? rect.left,
      sy: start?.y ?? rect.top,
    };
    this.dragged = false;
  }

  protected onFabPointerMove(event: PointerEvent): void {
    const ds = this.dragStart;
    if (!ds) return;
    if (typeof window === 'undefined') return;
    const dx = event.clientX - ds.px;
    const dy = event.clientY - ds.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.dragged = true;
    const maxX = window.innerWidth - FAB_SIZE;
    const maxY = window.innerHeight - FAB_SIZE;
    const x = Math.min(Math.max(0, ds.sx + dx), maxX);
    const y = Math.min(Math.max(0, ds.sy + dy), maxY);
    this.pos.set({ x, y });
  }

  protected onFabPointerUp(): void {
    this.dragStart = null;
  }

  protected onFabClick(event: Event): void {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    this.panelPos.set(this.computePanelPos(btn));
    this.toggle();
  }

  private computePanelPos(btn: HTMLElement): { left: number; top: number | null; bottom: number | null } | null {
    if (typeof window === 'undefined') return null;
    const rect = btn.getBoundingClientRect();
    const panelW = window.innerWidth >= 768 ? 384 : 320;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - panelW / 2), Math.max(8, window.innerWidth - panelW - 8));
    if (rect.top > window.innerHeight * 0.45) {
      const bottom = window.innerHeight - rect.top + 8;
      return { left, top: null, bottom };
    }
    const top = rect.bottom + 8;
    return { left, top, bottom: null };
  }

  protected playTrack(track: Track): void {
    this.audio.playTrack(track, this.tracks());
    this.audio.openNowPlaying();
  }

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
