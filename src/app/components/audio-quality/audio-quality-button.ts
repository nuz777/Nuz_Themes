import { Component, inject, input } from '@angular/core';
import {
  AudioQualityService,
  type AudioQuality,
} from '../../services/audio-quality.service';

@Component({
  selector: 'app-audio-quality-button',
  imports: [],
  templateUrl: './audio-quality-button.html',
})
export class AudioQualityButton {
  readonly compact = input<boolean>(false);

  protected readonly qualityService = inject(AudioQualityService);

  open(): void {
    this.qualityService.openModal();
  }

  get currentQuality(): AudioQuality {
    return this.qualityService.quality();
  }

  get currentQualityLabel(): string {
    switch (this.currentQuality) {
      case 'baja':
        return 'Baja (64 kbps)';
      case 'media':
        return 'Media (128 kbps)';
      case 'alta':
        return 'Alta (HD)';
    }
  }
}
