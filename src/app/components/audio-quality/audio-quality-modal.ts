import { Component, HostListener, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import {
  AudioQualityService,
  type AudioQuality,
  type AudioQualityOption,
} from '../../services/audio-quality.service';

@Component({
  selector: 'app-audio-quality-modal',
  imports: [],
  templateUrl: './audio-quality-modal.html',
})
export class AudioQualityModal {
  protected readonly audio = inject(AudioService);
  protected readonly qualityService = inject(AudioQualityService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  get isOpen(): boolean {
    return this.qualityService.isModalOpen();
  }

  get currentQuality(): AudioQuality {
    return this.qualityService.quality();
  }

  get options(): readonly AudioQualityOption[] {
    return this.qualityService.options;
  }

  selectQuality(q: AudioQuality): void {
    this.audio.changeQuality(q);
  }

  close(): void {
    this.qualityService.closeModal();
  }
}
