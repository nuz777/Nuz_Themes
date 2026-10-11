import { Injectable, inject, signal } from '@angular/core';
import type { Track } from '../models/track';
import { ToastService } from './toast.service';

export type AudioQuality = 'baja' | 'media' | 'alta';

export interface AudioQualityOption {
  id: AudioQuality;
  name: string;
  badge: string;
  bitrate: string;
  loadSpeed: string;
  description: string;
  warning?: string;
}

const QUALITY_STORAGE_KEY = 'nuz-audio-quality';

@Injectable({ providedIn: 'root' })
export class AudioQualityService {
  private readonly toast = inject(ToastService);

  readonly quality = signal<AudioQuality>(this.readInitialQuality());
  readonly isModalOpen = signal(false);

  openModal(): void {
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  toggleModal(): void {
    this.isModalOpen.update((v) => !v);
  }

  readonly options: readonly AudioQualityOption[] = [
    {
      id: 'baja',
      name: 'Baja',
      badge: 'Rápida',
      bitrate: '64 kbps',
      loadSpeed: 'Carga instantánea',
      description: 'Ideal para conexiones móviles lentas o ahorro de datos. La música empieza a sonar al instante.',
    },
    {
      id: 'media',
      name: 'Media',
      badge: 'Equilibrada',
      bitrate: '128 kbps',
      loadSpeed: 'Carga rápida',
      description: 'Recomendada. Excelente equilibrio entre sonido de alta fidelidad y tiempos de carga reducidos.',
    },
    {
      id: 'alta',
      name: 'Alta',
      badge: 'Máxima HD',
      bitrate: 'Original HD',
      loadSpeed: 'Archivos pesados',
      description: 'Máxima fidelidad sonora sin compresión extra.',
      warning: 'Requiere una excelente conexión a internet para evitar cortes y tiempos de carga prolongados.',
    },
  ];

  setQuality(newQuality: AudioQuality, notify = true): void {
    if (this.quality() === newQuality) return;

    this.quality.set(newQuality);
    this.persistQuality(newQuality);

    if (notify) {
      if (newQuality === 'alta') {
        this.toast.show(
          'Calidad Alta activada: Requiere una excelente conexión a internet para evitar interrupciones.',
          'info',
        );
      } else if (newQuality === 'baja') {
        this.toast.show(
          'Calidad Baja activada: Carga ultra rápida y menor consumo de datos.',
          'success',
        );
      } else {
        this.toast.show(
          'Calidad Media activada: Reproducción fluida y buen audio.',
          'success',
        );
      }
    }
  }

  resolveTrackUrl(track: Track, q: AudioQuality = this.quality()): string {
    if (!track.audioUrl) return '';

    // Si la pista provee URLs explícitas por calidad
    if (track.qualityUrls?.[q]) {
      return track.qualityUrls[q]!;
    }

    // Pistas locales o del usuario (blobs en memoria / IndexedDB)
    if (
      track.id.startsWith('user-') ||
      track.audioUrl.startsWith('blob:') ||
      track.audioUrl.startsWith('data:')
    ) {
      return track.audioUrl;
    }

    // Pistas del servidor en /music/
    const musicPrefix = '/music/';
    if (track.audioUrl.startsWith(musicPrefix)) {
      const rest = track.audioUrl.slice(musicPrefix.length);
      const cleanPath = rest.replace(/^(low\/|medium\/)/, '');

      if (q === 'baja') {
        return `${musicPrefix}low/${cleanPath}`;
      }
      if (q === 'media') {
        return `${musicPrefix}medium/${cleanPath}`;
      }
      return `${musicPrefix}${cleanPath}`;
    }

    return track.audioUrl;
  }

  private readInitialQuality(): AudioQuality {
    if (typeof window === 'undefined') return 'media';
    try {
      const stored = localStorage.getItem(QUALITY_STORAGE_KEY) as AudioQuality;
      if (stored === 'baja' || stored === 'media' || stored === 'alta') {
        return stored;
      }
    } catch {}
    // Por defecto 'media' para una experiencia ágil sin sacrificar audio
    return 'media';
  }

  private persistQuality(q: AudioQuality): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUALITY_STORAGE_KEY, q);
    } catch {}
  }
}
