import { Component, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';

@Component({
  selector: 'app-player-bar',
  imports: [],
  templateUrl: './player-bar.html',
})
export class PlayerBar {
  protected readonly audio = inject(AudioService);

  protected formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  protected onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.audio.seek(Number(input.value));
  }

  protected onVolume(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.audio.setVolume(Number(input.value));
  }
}
