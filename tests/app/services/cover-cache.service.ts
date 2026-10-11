import { TestBed } from '@angular/core/testing';
import { CoverCacheService } from '@/app/services/cover-cache.service';
import type { Track } from '@/app/models/track';

describe('CoverCacheService', () => {
  let service: CoverCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CoverCacheService],
    });
    service = TestBed.inject(CoverCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should preload high-priority urls without throwing', () => {
    expect(() => {
      service.preload(['/caratulas/image.webp', '/caratulas/cult.webp'], 'high');
    }).not.toThrow();
  });

  it('should preload queue covers correctly', () => {
    const playlist: Track[] = [
      { id: '1', title: 'T1', artist: 'A', album: 'Al', cover: '/c1.webp', audioUrl: '/1.mp3', duration: 100 },
      { id: '2', title: 'T2', artist: 'A', album: 'Al', cover: '/c2.webp', audioUrl: '/2.mp3', duration: 100 },
      { id: '3', title: 'T3', artist: 'A', album: 'Al', cover: '/c3.webp', audioUrl: '/3.mp3', duration: 100 },
    ];

    expect(() => {
      service.preloadQueue(playlist[0], playlist);
    }).not.toThrow();
  });
});
