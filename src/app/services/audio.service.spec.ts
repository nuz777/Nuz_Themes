import { TestBed } from '@angular/core/testing';
import { AudioService } from './audio.service';
import { OfflineStorageService } from './offline-storage.service';
import { TracksService } from './tracks.service';
import type { Track } from '../models/track';

describe('AudioService Persistence and AutoCache', () => {
  let service: AudioService;
  let offlineService: OfflineStorageService;
  let tracksService: TracksService;

  const sampleTrack: Track = {
    id: 'local1',
    title: 'tempdr',
    artist: 'Nuz',
    album: 'Animation',
    cover: '/caratulas/image.webp',
    audioUrl: '/music/tempdr.mp3',
    duration: 127,
  };

  const sampleTrack2: Track = {
    id: 'classic1',
    title: 'Gold',
    artist: 'Spandau Ballet',
    album: 'Gold',
    cover: '/caratulas/Gold.webp',
    audioUrl: '/music/Gold.mp3',
    duration: 227,
  };

  const cleanupKeys = () => {
    localStorage.removeItem('nuz-player-track-id');
    localStorage.removeItem('nuz-player-queue');
    localStorage.removeItem('nuz-player-queue-index');
    localStorage.removeItem('nuz-player-current-time');
    localStorage.removeItem('nuz-player-volume');
    localStorage.removeItem('nuz-player-shuffle');
    localStorage.removeItem('nuz-player-repeat');
  };

  beforeEach(() => {
    cleanupKeys();
    TestBed.configureTestingModule({
      providers: [AudioService, OfflineStorageService, TracksService],
    });
    service = TestBed.inject(AudioService);
    offlineService = TestBed.inject(OfflineStorageService);
    tracksService = TestBed.inject(TracksService);
  });

  afterEach(() => {
    cleanupKeys();
  });

  it('should persist volume to localStorage when changed', () => {
    service.setVolume(0.45);
    expect(service.volume()).toBe(0.45);
    expect(localStorage.getItem('nuz-player-volume')).toBe('0.45');
  });

  it('should persist repeat mode to localStorage when toggled', () => {
    expect(service.repeat()).toBe('off');
    service.toggleRepeat();
    expect(service.repeat()).toBe('all');
    expect(localStorage.getItem('nuz-player-repeat')).toBe('all');
    service.toggleRepeat();
    expect(service.repeat()).toBe('one');
    expect(localStorage.getItem('nuz-player-repeat')).toBe('one');
  });

  it('should persist shuffle mode to localStorage when toggled', () => {
    expect(service.shuffle()).toBe(false);
    service.toggleShuffle();
    expect(service.shuffle()).toBe(true);
    expect(localStorage.getItem('nuz-player-shuffle')).toBe('true');
  });

  it('should persist current track and queue when playing a track', () => {
    const queue = [sampleTrack, sampleTrack2];
    service.playTrack(sampleTrack, queue);

    expect(service.currentTrack()?.id).toBe(sampleTrack.id);
    expect(localStorage.getItem('nuz-player-track-id')).toBe(sampleTrack.id);

    const savedQueue = JSON.parse(localStorage.getItem('nuz-player-queue') || '[]');
    expect(savedQueue).toEqual(['local1', 'classic1']);
    expect(localStorage.getItem('nuz-player-queue-index')).toBe('0');
  });

  it('should call autoCache when warm() is invoked for an uncached track', () => {
    const spy = vi.spyOn(offlineService, 'autoCache').mockResolvedValue();
    service.warm(sampleTrack);
    expect(spy).toHaveBeenCalledWith(sampleTrack);
  });

  it('should not call autoCache when warm() is invoked for an already cached track', () => {
    vi.spyOn(offlineService, 'isCached').mockReturnValue(true);
    const spy = vi.spyOn(offlineService, 'autoCache');
    service.warm(sampleTrack);
    expect(spy).not.toHaveBeenCalled();
  });
});
