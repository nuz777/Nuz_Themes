import { TestBed } from '@angular/core/testing';
import { AudioQualityService } from './audio-quality.service';
import { ToastService } from './toast.service';
import type { Track } from '../models/track';

describe('AudioQualityService', () => {
  let service: AudioQualityService;
  let toast: ToastService;

  const sampleTrack: Track = {
    id: 'test-track',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    cover: '/caratulas/image.webp',
    audioUrl: '/music/tempdr.mp3',
    duration: 120,
  };

  const userTrack: Track = {
    id: 'user-123',
    title: 'User Song',
    artist: 'User',
    album: 'Local',
    cover: '/caratulas/image.webp',
    audioUrl: 'blob:http://localhost:4200/some-guid',
    duration: 60,
  };

  beforeEach(() => {
    localStorage.removeItem('nuz-audio-quality');
    TestBed.configureTestingModule({
      providers: [AudioQualityService, ToastService],
    });
    service = TestBed.inject(AudioQualityService);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    localStorage.removeItem('nuz-audio-quality');
  });

  it('should initialize with default quality (media)', () => {
    expect(service.quality()).toBe('media');
  });

  it('should have 3 quality options: baja, media, and alta', () => {
    const ids = service.options.map((o) => o.id);
    expect(ids).toEqual(['baja', 'media', 'alta']);
  });

  it('should have explicit warning on alta quality specifying excellent connection', () => {
    const altaOption = service.options.find((o) => o.id === 'alta');
    expect(altaOption).toBeDefined();
    expect(altaOption?.warning).toBeDefined();
    expect(altaOption?.warning?.toLowerCase()).toContain('excelente conexión');
  });

  it('should resolve URLs according to quality', () => {
    expect(service.resolveTrackUrl(sampleTrack, 'baja')).toBe('/music/low/tempdr.mp3');
    expect(service.resolveTrackUrl(sampleTrack, 'media')).toBe('/music/medium/tempdr.mp3');
    expect(service.resolveTrackUrl(sampleTrack, 'alta')).toBe('/music/tempdr.mp3');
  });

  it('should not alter blob or user tracks', () => {
    expect(service.resolveTrackUrl(userTrack, 'baja')).toBe(userTrack.audioUrl);
    expect(service.resolveTrackUrl(userTrack, 'alta')).toBe(userTrack.audioUrl);
  });

  it('should change quality, persist to localStorage, and display notification', () => {
    service.setQuality('baja');
    expect(service.quality()).toBe('baja');
    expect(localStorage.getItem('nuz-audio-quality')).toBe('baja');

    service.setQuality('alta');
    expect(service.quality()).toBe('alta');
    expect(localStorage.getItem('nuz-audio-quality')).toBe('alta');
    const lastToast = toast.toasts()[toast.toasts().length - 1];
    expect(lastToast.text.toLowerCase()).toContain('excelente conexión');
  });
});
