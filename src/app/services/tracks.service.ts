import { Injectable, inject, signal } from '@angular/core';
import type { Track } from '../models/track';
import { OfflineStorageService } from './offline-storage.service';
import { ToastService } from './toast.service';

export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string;
  trackIds: string[];
  userCreated?: boolean;
}

export interface UserTrackMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string; // dataURL o ruta
  duration: number;
  createdAt: number;
}

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/300/300?grayscale`;
const USER_TRACKS_KEY = 'nuz-user-tracks';

@Injectable({ providedIn: 'root' })
export class TracksService {
  readonly tracks = signal<Track[]>([]);
  readonly playlists = signal<Playlist[]>([]);
  readonly userTracks = signal<UserTrackMetadata[]>([]);

  private readonly offline = inject(OfflineStorageService);
  private readonly toast = inject(ToastService);

  constructor() {
    this.userTracks.set(this.readUserTracks());
    this.tracks.set([...this.buildUserTracks(), ...this.buildTracks()]);
    this.playlists.set([...this.buildPlaylists(), ...this.readUserPlaylists()]);
    void this.hydrateUserCovers();
  }

  getTrack(id: string): Track | undefined {
    return this.tracks().find((t) => t.id === id);
  }

  getPlaylist(id: string): Playlist | undefined {
    return this.playlists().find((p) => p.id === id);
  }

  getUserPlaylists(): Playlist[] {
    return this.playlists().filter((playlist) => playlist.userCreated);
  }

  createPlaylist(name: string): Playlist | null {
    const cleanName = name.trim();
    if (!cleanName) return null;

    const playlist: Playlist = {
      id: `user-${Date.now()}`,
      name: cleanName,
      description: 'Playlist creada por ti.',
      cover: '/caratulas/image.webp',
      trackIds: [],
      userCreated: true,
    };
    this.playlists.update((playlists) => [...playlists, playlist]);
    this.persistUserPlaylists();
    return playlist;
  }

  addTrackToPlaylist(playlistId: string, trackId: string): boolean {
    let added = false;
    this.playlists.update((playlists) => playlists.map((playlist) => {
      if (playlist.id !== playlistId || !playlist.userCreated || playlist.trackIds.includes(trackId)) {
        return playlist;
      }
      added = true;
      return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
    }));
    if (added) this.persistUserPlaylists();
    return added;
  }

  deletePlaylist(playlistId: string): boolean {
    const playlist = this.getPlaylist(playlistId);
    if (!playlist?.userCreated) return false;

    this.playlists.update((playlists) => playlists.filter((item) => item.id !== playlistId));
    this.persistUserPlaylists();
    return true;
  }

  removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
    let removed = false;
    this.playlists.update((playlists) => playlists.map((playlist) => {
      if (!playlist.userCreated || playlist.id !== playlistId || !playlist.trackIds.includes(trackId)) {
        return playlist;
      }
      removed = true;
      return { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) };
    }));
    if (removed) this.persistUserPlaylists();
    return removed;
  }

  getPlaylistTracks(id: string): Track[] {
    const playlist = this.getPlaylist(id);
    if (!playlist) return [];
    return playlist.trackIds
      .map((tid) => this.getTrack(tid))
      .filter((t): t is Track => !!t);
  }

  getAllTracks(): Track[] {
    return this.tracks();
  }

  getUserTracks(): Track[] {
    return this.tracks().filter((t) => t.id.startsWith('user-'));
  }

  getUserTrackCount(): number {
    return this.userTracks().length;
  }

  async addUserTrack(params: {
    file: File;
    cover?: File | null;
    noCover?: boolean;
    title?: string;
    artist?: string;
    album?: string;
  }): Promise<Track | null> {
    if (typeof window === 'undefined') return null;

    const file = params.file;
    const audioBlob: Blob = file;
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const [coverResult, duration] = await Promise.all([
      this.processCoverImage(params.cover || null, audioBlob, { noCover: params.noCover }),
      this.extractAudioDuration(audioBlob),
    ]);

    if (coverResult.blob) {
      try {
        await Promise.race([
          this.offline.storeUserCover(id, coverResult.blob),
          new Promise((_, reject) => setTimeout(() => reject(new Error('storeUserCover timeout')), 3000)),
        ]);
      } catch {
        // Fallback: el cover continúa visible desde la DataURL segura en memoria y metadata
      }
    }

    const safeTitle = (params.title || '').trim() || this.getBaseName(file.name) || 'Pista de audio';

    const metadata: UserTrackMetadata = {
      id,
      title: safeTitle,
      artist: params.artist?.trim() || 'Artista desconocido',
      album: params.album?.trim() || 'Música local',
      cover: coverResult.coverUrl,
      duration,
      createdAt: Date.now(),
    };

    const audioUrl = URL.createObjectURL(audioBlob);
    this.offline.registerObjectUrl(id, audioUrl);

    try {
      await Promise.race([
        this.offline.storeUserTrack(id, audioBlob),
        new Promise((_, reject) => setTimeout(() => reject(new Error('storeUserTrack timeout')), 3500)),
      ]);
    } catch {
      // Si IndexedDB demora o tiene cupo lleno, el audio se reproduce desde memoria de forma inmediata
    }

    this.userTracks.update((items) => [metadata, ...items]);
    this.persistUserTracks();

    const track: Track = {
      id,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      cover: coverResult.coverUrl,
      audioUrl,
      duration: metadata.duration,
    };

    this.tracks.update((tracks) => [track, ...tracks]);
    this.toast.show(`"${track.title}" guardada en tu navegador`, 'success', track.cover, track.title);
    return track;
  }

  removeUserTrack(id: string): boolean {
    const track = this.tracks().find((t) => t.id === id);
    const exists = this.userTracks().some((meta) => meta.id === id);
    if (!exists) return false;

    this.userTracks.update((items) => items.filter((item) => item.id !== id));
    this.persistUserTracks();

    this.tracks.update((tracks) => tracks.filter((t) => t.id !== id));

    let playlistsModified = false;
    this.playlists.update((playlists) =>
      playlists.map((pl) => {
        if (!pl.userCreated || !pl.trackIds.includes(id)) return pl;
        playlistsModified = true;
        return { ...pl, trackIds: pl.trackIds.filter((tid) => tid !== id) };
      }),
    );
    if (playlistsModified) {
      this.persistUserPlaylists();
    }

    try {
      this.offline.removeUserTrack(id);
    } catch {
      // no-op
    }

    if (track) {
      this.toast.show(`"${track.title}" eliminada de tu navegador`, 'success');
    }

    return true;
  }

  updateTrackDuration(id: string, duration: number): void {
    const dur = Math.round(duration);
    if (!Number.isFinite(dur) || dur <= 0) return;

    const currentTrack = this.tracks().find((t) => t.id === id);
    if (currentTrack && currentTrack.duration === dur) return;

    this.tracks.update((tracks) =>
      tracks.map((t) => (t.id === id ? { ...t, duration: dur } : t)),
    );

    if (id.startsWith('user-')) {
      const userMeta = this.userTracks().find((m) => m.id === id);
      if (userMeta && userMeta.duration !== dur) {
        this.userTracks.update((items) =>
          items.map((m) => (m.id === id ? { ...m, duration: dur } : m)),
        );
        this.persistUserTracks();
      }
    }
  }

  async updateTrackCover(id: string, file: Blob | File): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
      const coverResult = await this.processCoverImage(file);
      if (!coverResult.coverUrl) return null;

      this.tracks.update((tracks) =>
        tracks.map((t) => (t.id === id ? { ...t, cover: coverResult.coverUrl } : t)),
      );

      this.userTracks.update((items) =>
        items.map((m) => (m.id === id ? { ...m, cover: coverResult.coverUrl } : m)),
      );
      this.persistUserTracks();

      if (coverResult.blob) {
        try {
          await this.offline.storeUserCover(id, coverResult.blob);
        } catch {
          // ignore
        }
      }

      const updatedTrack = this.getTrack(id);
      if (updatedTrack) {
        this.toast.show(`Carátula de "${updatedTrack.title}" actualizada`, 'success', coverResult.coverUrl, updatedTrack.title);
      }

      return coverResult.coverUrl;
    } catch (err) {
      console.error('Error al actualizar carátula:', err);
      this.toast.show('No se pudo actualizar la carátula', 'error');
      return null;
    }
  }

  private buildUserTracks(): Track[] {
    return this.userTracks().map((meta) => ({
      id: meta.id,
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      cover: meta.cover || '/caratulas/image.webp',
      audioUrl: this.offline.getUserTrackUrl(meta.id) || '',
      duration: meta.duration,
    }));
  }

  private async hydrateUserCovers(): Promise<void> {
    if (typeof window === 'undefined') return;
    for (const meta of this.userTracks()) {
      if (meta.cover && meta.cover !== '/caratulas/image.webp') {
        continue;
      }
      const recoveredCover = await this.offline.loadUserCoverDataUrl(meta.id);
      if (recoveredCover) {
        this.tracks.update((tracks) =>
          tracks.map((t) => (t.id === meta.id ? { ...t, cover: recoveredCover } : t)),
        );
        this.userTracks.update((items) =>
          items.map((m) => (m.id === meta.id ? { ...m, cover: recoveredCover } : m)),
        );
        this.persistUserTracks();
      }
    }
  }

  private readUserTracks(): UserTrackMetadata[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(USER_TRACKS_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is UserTrackMetadata => {
        if (!item || typeof item !== 'object') return false;
        const t = item as Partial<UserTrackMetadata>;
        return typeof t.id === 'string' && typeof t.title === 'string' && typeof t.cover === 'string';
      });
    } catch {
      return [];
    }
  }

  private persistUserTracks(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(USER_TRACKS_KEY, JSON.stringify(this.userTracks()));
    } catch (e) {
      console.warn('LocalStorage quota reached, saving with lightweight metadata', e);
      try {
        const lightweight = this.userTracks().map((item) => ({
          ...item,
          cover: item.cover.length > 80000 ? '/caratulas/image.webp' : item.cover,
        }));
        window.localStorage.setItem(USER_TRACKS_KEY, JSON.stringify(lightweight));
      } catch {
        // Ignore
      }
    }
  }

  async processCoverImage(
    coverSource: Blob | File | null,
    audioBlob?: Blob,
    options?: { noCover?: boolean },
  ): Promise<{ blob: Blob | null; coverUrl: string }> {
    if (typeof window === 'undefined') {
      return { blob: null, coverUrl: '/caratulas/image.webp' };
    }

    if (options?.noCover) {
      return { blob: null, coverUrl: '/caratulas/image.webp' };
    }

    let source: Blob | File | null = coverSource;
    if (!source && audioBlob) {
      source = await this.extractEmbeddedCover(audioBlob);
    }

    if (!source) {
      return { blob: null, coverUrl: '/caratulas/image.webp' };
    }

    try {
      const coverUrl = await this.processImageToDataUrl(source, 360, 0.82);
      return { blob: source, coverUrl };
    } catch (err) {
      console.warn('Fallback al usar carátula original directa:', err);
      try {
        const raw = await this.fileToDataUrl(source);
        if (raw && raw.startsWith('data:image/')) {
          return { blob: source, coverUrl: raw };
        }
      } catch {
        // ignore
      }
      return { blob: source, coverUrl: '/caratulas/image.webp' };
    }
  }

  private fileToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(reader.error || new Error('Error leyendo archivo'));
      reader.readAsDataURL(blob);
    });
  }

  private async processImageToDataUrl(source: Blob, maxDim = 360, quality = 0.82): Promise<string> {
    const rawDataUrl = await this.fileToDataUrl(source);
    if (!rawDataUrl || !rawDataUrl.startsWith('data:image/')) {
      throw new Error('DataURL inválido');
    }

    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        resolve(rawDataUrl);
      }, 2500);

      const img = new Image();
      img.onload = () => {
        clearTimeout(timer);
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) {
            return resolve(rawDataUrl);
          }

          const size = Math.min(w, h);
          const sx = Math.max(0, Math.round((w - size) / 2));
          const sy = Math.max(0, Math.round((h - size) / 2));
          const targetSize = Math.min(size, maxDim);

          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(rawDataUrl);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);

          let output = '';
          try {
            output = canvas.toDataURL('image/webp', quality);
          } catch {
            output = '';
          }
          if (!output || !output.startsWith('data:image/webp')) {
            try {
              output = canvas.toDataURL('image/jpeg', quality);
            } catch {
              output = '';
            }
          }

          if (output && output.startsWith('data:image/')) {
            resolve(output);
          } else {
            resolve(rawDataUrl);
          }
        } catch {
          resolve(rawDataUrl);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(rawDataUrl);
      };

      img.src = rawDataUrl;
    });
  }

  async extractEmbeddedCover(blob: Blob): Promise<Blob | null> {
    if (typeof window === 'undefined') return null;
    try {
      const sliceSize = Math.min(blob.size, 10 * 1024 * 1024);
      const head = await blob.slice(0, sliceSize).arrayBuffer();
      const u8 = new Uint8Array(head);
      if (u8.length < 10) return null;

      if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) {
        const v = u8[3];
        const tagSize = ((u8[6] & 0x7f) << 21) | ((u8[7] & 0x7f) << 14) | ((u8[8] & 0x7f) << 7) | (u8[9] & 0x7f);
        let pos = 10;
        const max = Math.min(tagSize + 10, u8.length);

        while (pos < max - 10) {
          const frameId = String.fromCharCode(u8[pos], u8[pos + 1], u8[pos + 2], u8[pos + 3]);
          if (!/^[A-Z0-9]{3,4}$/.test(frameId)) break;

          let frameSize: number;
          let headerOffset = 10;
          if (v === 4) {
            frameSize = ((u8[pos + 4] & 0x7f) << 21) | ((u8[pos + 5] & 0x7f) << 14) | ((u8[pos + 6] & 0x7f) << 7) | (u8[pos + 7] & 0x7f);
          } else if (v === 3) {
            frameSize = (u8[pos + 4] << 24) | (u8[pos + 5] << 16) | (u8[pos + 6] << 8) | u8[pos + 7];
          } else {
            // ID3v2.2 PIC frame
            frameSize = (u8[pos + 3] << 16) | (u8[pos + 4] << 8) | u8[pos + 5];
            headerOffset = 6;
          }

          if (frameSize <= 0 || pos + headerOffset + frameSize > u8.length) break;

          if (frameId === 'APIC' || frameId.startsWith('PIC')) {
            const frame = u8.subarray(pos + headerOffset, pos + headerOffset + frameSize);

            // Búsqueda directa por Magic Bytes para evitar fallos de codificación de texto
            let imgStart = -1;
            let mime = 'image/jpeg';

            for (let i = 1; i < frame.length - 4; i++) {
              if (frame[i] === 0xff && frame[i + 1] === 0xd8 && frame[i + 2] === 0xff) {
                imgStart = i;
                mime = 'image/jpeg';
                break;
              }
              if (frame[i] === 0x89 && frame[i + 1] === 0x50 && frame[i + 2] === 0x4e && frame[i + 3] === 0x47) {
                imgStart = i;
                mime = 'image/png';
                break;
              }
              if (frame[i] === 0x52 && frame[i + 1] === 0x49 && frame[i + 2] === 0x46 && frame[i + 3] === 0x46) {
                imgStart = i;
                mime = 'image/webp';
                break;
              }
            }

            if (imgStart !== -1) {
              const imgBytes = frame.subarray(imgStart);
              return new Blob([imgBytes], { type: mime });
            }
          }
          pos += headerOffset + frameSize;
        }
      }
    } catch {
      // Ignorar fallos de extracción
    }
    return null;
  }

  private async extractAudioDuration(blob: Blob): Promise<number> {
    if (typeof Audio === 'undefined') return 0;
    return new Promise((resolve) => {
      let settled = false;
      const done = (dur: number) => {
        if (settled) return;
        settled = true;
        clean();
        resolve(dur);
      };

      // Si los metadatos demoran más de 1.5s, continuar inmediatamente para no trabar el guardado
      const timer = setTimeout(() => done(0), 1500);

      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';

      const clean = () => {
        clearTimeout(timer);
        try {
          URL.revokeObjectURL(url);
          audio.removeAttribute('src');
          audio.load();
        } catch {}
      };

      audio.onloadedmetadata = () => {
        const dur = Math.round(audio.duration) || 0;
        done(dur);
      };

      audio.onerror = () => {
        done(0);
      };

      try {
        audio.src = url;
        audio.load();
      } catch {
        done(0);
      }
    });
  }

  private getBaseName(name: string): string {
    if (!name) return 'Pista de audio';
    const base = name.replace(/\.[^/.]+$/, '').trim();
    return base || name.trim() || 'Pista de audio';
  }

  private readUserPlaylists(): Playlist[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('nuz-user-playlists');
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((playlist): playlist is Playlist => {
        if (!playlist || typeof playlist !== 'object') return false;
        const item = playlist as Partial<Playlist>;
        return item.userCreated === true
          && typeof item.id === 'string'
          && typeof item.name === 'string'
          && Array.isArray(item.trackIds);
      });
    } catch {
      return [];
    }
  }

  private persistUserPlaylists(): void {
    if (typeof window === 'undefined') return;
    const userPlaylists = this.getUserPlaylists();
    window.localStorage.setItem('nuz-user-playlists', JSON.stringify(userPlaylists));
  }

  private buildTracks(): Track[] {
    return [
      {
        id: 'local1',
        title: 'tempdr',
        artist: 'Nuz',
        album: 'Animation',
        cover: '/caratulas/image.webp',
        audioUrl: '/music/tempdr.mp3',
        duration: 127,
      },
      {
        id: 'classic1',
        title: 'Gold',
        artist: 'Spandau Ballet',
        album: 'Gold',
        cover: '/caratulas/' + encodeURIComponent('GoldSpandau Ballet .webp'),
        audioUrl: '/music/' + encodeURIComponent('Gold; Spandau Ballet (Español - Inglés).mp3'),
        duration: 227,
      },
      {
        id: 'classic2',
        title: 'The Less I Know The Better',
        artist: 'Tame Impala',
        album: 'Currents',
        cover: '/caratulas/' + encodeURIComponent('TameImpala - TheLessIKnowTheBetter.webp'),
        audioUrl: '/music/' + encodeURIComponent('Tame Impala - The Less I Know The Better (Audio).mp3'),
        lyricsUrl: '/lyrics/classic2.lrc',
        duration: 217,
      },
      {
        id: 'nuz1',
        title: 'Passionate highs',
        artist: 'Snow Strippers',
        album: 'Snow Strippers',
        cover: '/caratulas/' + encodeURIComponent('Snow Strippers - Passionate highs.webp'),
        audioUrl: '/music/' + encodeURIComponent('Snow Strippers - Passionate highs (slowed + reverb).mp3'),
        duration: 249,
      },
      {
        id: 'nuz2',
        title: 'Stuck Next To You',
        artist: 'Tiishe',
        album: 'Tiishe',
        cover: '/caratulas/' + encodeURIComponent('StuckNextToYo -Tiishe.webp'),
        audioUrl: '/music/' + encodeURIComponent('Stuck Next To You - Tiishe [Slowed] (prod.voidrave99).mp3'),
        duration: 126,
      },
      {
        id: 'nuz3',
        title: 'lose me',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/lose_me.webp',
        audioUrl: '/music/' + encodeURIComponent('lose me (slowed).mp3'),
        duration: 194,
      },
      {
        id: 'sni1',
        title: 'Kurxxed Ultimate',
        artist: 'Kurxxed Emeraldz',
        album: 'Kurxxed Emeraldz',
        cover: '/caratulas/kurxedEzxmelards.webp',
        audioUrl: '/music/' + encodeURIComponent('__Kurxxed Ultimate__ Kurxxed Emeraldz Mashup.mp3'),
        duration: 322,
      },
      {
        id: 'sni2',
        title: 'chainsaw',
        artist: 'maple',
        album: 'maple',
        cover: '/caratulas/chaisaw.webp',
        audioUrl: '/music/' + encodeURIComponent('chainsaww-maple ft. slaywitme(siouxxie)(slowed).mp3'),
        duration: 193,
      },
      {
        id: 'sni3',
        title: 'so bitter',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/sobitter.webp',
        audioUrl: '/music/' + encodeURIComponent('so bitter (super slowed).mp3'),
        duration: 172,
      },
      {
        id: 'sni4',
        title: 'SMOKE IT OFF!',
        artist: 'Lumi Athena ft. jnhygs',
        album: 'Lumi Athena',
        cover: '/caratulas/smokeofflumiathena.webp',
        audioUrl: '/music/' + encodeURIComponent('Lumi Athena - SMOKE IT OFF! ft. jnhygs.mp3'),
        duration: 120,
      },
      {
        id: 'sni5',
        title: 'One Night in Berlin',
        artist: 'Baby Jane',
        album: 'Snicore',
        cover: '/caratulas/babyjane.webp',
        audioUrl: '/music/' + encodeURIComponent('Baby Jane - One Night in Berlin (Nightcore).mp3'),
        duration: 165,
      },
      {
        id: 'ph1',
        title: 'AUTOMOTIVO ANTI-CELESTIAL',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/AUTOMOTIVOANTI-CELESTIAL .webp',
        audioUrl: '/music/' + encodeURIComponent('AUTOMOTIVO ANTI-CELESTIAL.mp3'),
        duration: 220,
      },
      {
        id: 'ph2',
        title: 'MONTAGEM HIPERTÉTICA',
        artist: 'Nuz',
        album: 'Phonk',
        cover: '/caratulas/' + encodeURIComponent('MONTAGEM DOENÇA HIPERTÉTICA (Slowed).webp'),
        audioUrl: '/music/' + encodeURIComponent('MONTAGEM DOENÇA HIPERTÉTICA (Slowed).mp3'),
        duration: 103,
      },
      {
        id: 'ph3',
        title: 'MONTAGEM TALENTO 3',
        artist: 'Nuz',
        album: 'Phonk',
        cover: '/caratulas/MontagenGritos.webp',
        audioUrl: '/music/Montagem Gritos Talento 3 (super slowed).mp3',
        duration: 94,
      },
      {
        id: 'ph4',
        title: 'MONTAGEM DIMENSION',
        artist: 'Nuz',
        album: 'Phonk',
        cover: '/caratulas/montagemdimesion.webp',
        videoUrl: '/video/' + encodeURIComponent('MONTAGEM DIMENSION.mp4'),
        audioUrl: '/music/MONTAGEM DIMENSION.mp3',
        duration: 69,
      },

       {
        id: 'ph7',
        title: 'MONTAGEM DIMENSION',
        artist: 'Odetari',
        album: 'Phonk',
        cover: '/caratulas/heavylove.webp',
        audioUrl: '/music/HeavyLove.mp3',
        duration: 142,
      },
      {
        id: 'ph5',
        title: 'Baixo Cristal',
        artist: 'Teclas',
        album: 'Phonk',
        cover: '/caratulas/baixocristal.webp',
        audioUrl: '/music/Baixo Cristal Teclas.mp3',
        duration: 109,
      },
      {
        id: 'ph6',
        title: 'OGAME',
        artist: 'Nuz',
        album: 'Phonk',
        cover: '/caratulas/agome.webp',
        audioUrl: '/music/OGAME.mp3',
        duration: 114,
      },
      {
        id: 'classic3',
        title: 'Take Me to Your Heart',
        artist: 'Rick Astley',
        album: 'Hold Me in Your Arms',
        cover: '/caratulas/takemetoyourheart.webp',
        audioUrl: '/music/' + encodeURIComponent('Take Me to Your Heart (Autumn Leaves Mix).mp3'),
        lyricsUrl: '/lyrics/takeme.lrc',
        duration: 400,
      },
      {
        id: 'classic4',
        title: 'Gyoretsu no dekiru Eirin Shinryojo',
        artist: 'Eirin Shinryojo',
        album: 'Classic',
        cover: '/caratulas/' + encodeURIComponent('Gyoretsu no dekiru Eirin Shinryojo.webp'),
        audioUrl: '/music/' + encodeURIComponent('Gyoretsu no dekiru Eirin Shinryojo.mp3'),
        duration: 207,
      },
      {
        id: 'anim1',
        title: 'Tokyo Reggie',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/TokyoReggie.webp',
        audioUrl: '/music/' + encodeURIComponent('Tokyo Reggie.mp3'),
        duration: 260,
      },
      {
        id: 'anim2',
        title: 'Fall From The Sky Pt.2',
        artist: 'Stakillaz',
        album: 'Animation',
        cover: '/caratulas/ROMANCEPLANET.webp',
        audioUrl: '/music/' + encodeURIComponent('ROMANCEPLANET w STAKILLAZ - FALL FROM THE SKY PT.2 (OFFICIAL AUDIO).mp3'),
        duration: 98,
      },
      {
        id: 'anim3',
        title: 'Aishite, Aishite, Aishite',
        artist: 'Kikuo',
        album: 'Animation',
        cover: '/caratulas/ashide.webp',
        audioUrl: '/music/' + encodeURIComponent('aishite, aishite, aishite kikuo.mp3'),
        duration: 250,
      },
      {
        id: 'anim4',
        title: 'Looping the Rooms',
        artist: 'Hatsune Miku',
        album: 'Animation',
        cover: '/caratulas/miku.webp',
        audioUrl: '/music/' + encodeURIComponent('Looping the Rooms ft. Hatsune Miku.mp3'),
        videoUrl: '/video/' + encodeURIComponent('ループザルーム feat. 初音ミク Looping the Rooms ft. Hatsune Miku.mp4'),
        duration: 134,
      },
      {
        id: 'anim5',
        title: 'Alors on danse',
        artist: 'Indila',
        album: 'Animation',
        cover: '/caratulas/Alors on danse.webp',
        audioUrl: '/music/Alors on danse (Radio Edit).mp3',
        duration: 208,
      },
      {
        id: 'anim6',
        title: 'Hey Kids',
        artist: 'Molina',
        album: 'Animation',
        cover: '/caratulas/heykids.webp',
        audioUrl: '/music/' + encodeURIComponent('Molina - Hey Kids [Traducción al español].mp3'),
        duration: 237,
      },
      {
        id: 'anim7',
        title: 'Keep Their Heads Ringin',
        artist: 'EL mathafoka Dr. Dre',
        album: 'Animation',
        cover: '/caratulas/Dr. Dre- Keep Their Heads Ringin’ (slowed n reverb).webp',
        audioUrl: '/music/' + encodeURIComponent('nuzw.mp3'),
        videoUrl: '/video/keeptheirrigin.mp4',
        duration: 338,
      },
      {
        id: 'anim8',
        title: 'Cult memeber',
        artist: 'Three',
        album: 'Animation',
        cover: '/caratulas/cult.webp',
        audioUrl: '/music/CultMember.mp3',
        backgroundColor: '#0a1728',
        showSnow: true,
        hideRhythmBars: true,
        duration: 343,
      },
      {
        id: 'nuz4',
        title: 'Russian Car Driver',
        artist: 'OST',
        album: 'Russian Car Driver HD',
        cover: '/caratulas/russiandriver.webp',
        audioUrl: '/music/' + encodeURIComponent('Russian Car Driver HD OST - Opening Music (Without any background noises).mp3'),
        duration: 107,
      },
      {
        id: 'nuz5',
        title: 'Brooklyn Blood',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/' + encodeURIComponent('𝐁𝐫𝐨𝐨𝐤𝐥𝐲𝐧𝐁𝐥𝐨𝐨𝐝𝐏𝐨𝐩𝐗𝐕𝐚𝐜𝐚𝐭𝐢𝐨𝐧𝐁𝐢𝐛𝐥𝐞𝐒𝐜𝐡𝐨𝐨𝐥.webp'),
        audioUrl: '/music/' + encodeURIComponent('𝐁𝐫𝐨𝐨𝐤𝐥𝐲𝐧 𝐁𝐥𝐨𝐨𝐝 𝐏𝐨𝐩 𝐗 𝐕𝐚𝐜𝐚𝐭𝐢𝐨𝐧 𝐁𝐢𝐛𝐥𝐞 𝐒𝐜𝐡𝐨𝐨𝐥 (𝐒𝐥𝐨𝐰𝐞𝐝).mp3'),
        duration: 324,
      },
      {
        id: 'nuz6',
        title: 'Make U Whole',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/makeuwhole.webp',
        audioUrl: '/music/Make U Whole.mp3',
        duration: 463,
      },
      {
        id: 'doom1',
        title: 'Счастье за горами',
        artist: 'Панелька',
        album: 'Nuz',
        cover: '/caratulas/' + encodeURIComponent('Панелька - Счастье за горами (official music video 2022)  Russian doomer video.webp'),
        audioUrl: '/music/' + encodeURIComponent('Панелька - Счастье за горами (official music video 2022)  Russian doomer video.mp3'),
        lyricsUrl: '/lyrics/doom1.lrc',
        duration: 159,
      },
      {
        id: 'nuz7',
        title: 'Люблю',
        artist: 'БИТЬМРАЗЕЙ',
        album: 'Nuz',
        cover: '/caratulas/katyusha.webp',
        audioUrl: '/music/' + encodeURIComponent('Люблю- БИТЬМРАЗЕЙ.mp3'),
        videoUrl: '/video/' + encodeURIComponent('bitmrazey_ljublju.mp4'),
        duration: 93,
      },
      {
        id: 'nuz8',
        title: 'Baseball Bat Discipline',
        artist: 'Technology',
        album: 'Nuz',
        cover: '/caratulas/Baseball Bat Discipline -Technology.webp',
        audioUrl: '/music/' + encodeURIComponent('Baseball Bat Discipline -Technology.mp3'),
        duration: 222,
      },
      {
        id: 'nuz9',
        title: 'Verano Finito',
        artist: 'Post-punk selection',
        album: 'relax_time',
        cover: '/caratulas/' + encodeURIComponent('Лето не бесконечное как и твои сил.webp'),
        audioUrl: '/music/' + encodeURIComponent('Лето не бесконечное как и твои силы Post-punk selection Doomer music.mp3'),
        chapters: [
          { time: 0, title: 'Ploho - Не будем прощаться' },
          { time: 239, title: 'Nürnberg – Biessensoŭnasć' },
          { time: 419, title: 'corn wave - wake asleep' },
          { time: 611, title: 'provulok - The pain won\'t stop' },
          { time: 854, title: 'Буерак - Шаги' },
          { time: 1026, title: 'Увула - Дранк' },
          { time: 1270, title: 'Спящие - Память о тебе' },
          { time: 1420, title: 'Ploho - Горький опыт' },
          { time: 1623, title: 'Дисциплина Безбольной Биты - Технология' },
        ],
        blurBackground: true,
        hideRhythmBars: true,
        duration: 1846,
      },
      {
        id: 'relax2',
        title: 'Descanso Final',
        artist: 'Post-punk selection',
        album: 'relax_time',
        cover: '/caratulas/' + encodeURIComponent('Плейлист для того, чтобы последний раз отдохнуть.webp'),
        audioUrl: '/music/' + encodeURIComponent('Плейлист для того, чтобы последний раз отдохнуть.mp3'),
        chapters: [
          { time: 0, title: 'Где Фантом? - Рельсы' },
          { time: 164, title: 'Море ясности - Корабль в бутылке' },
          { time: 395, title: 'Перемотка - Солнце' },
          { time: 581, title: 'Дурной Вкус - Думаешь ты' },
          { time: 770, title: 'Стул Сталина - Лэп' },
          { time: 995, title: 'corn wave - nothing' },
        ],
        backgroundColor: '#000000',
        backgroundImage: '/caratulas/fondoMusicrusa.webp',
        blurBackground: true,
        hideRhythmBars: true,
        duration: 1196,
      },
      {
        id: 'relax3',
        title: 'Cry',
        artist: 'Charlie Puth',
        album: 'relax_time',
        cover: '/caratulas/' + encodeURIComponent('Charlie Puth - Cry .webp'),
        audioUrl: '/music/' + encodeURIComponent('Charlie Puth - Cry (with Kenny G) [Official Audio].mp3'),
        backgroundColor: '#1e3a8a',
        showSun: true,
        showStars: true,
        blurBackground: true,
        hideRhythmBars: true,
        duration: 188,
      },
    ];
  }

  private buildPlaylists(): Playlist[] {
    return [
      {
        id: 'animation',
        name: 'animation',
        description: 'Música de tus animaciones.',
        cover: '/caratulas/image.webp',
        trackIds: ['local1', 'anim1', 'anim2', 'anim3', 'anim4', 'anim5', 'anim6', 'anim7', 'anim8'],
      },
      {
        id: 'phonk',
        name: 'phonk',
        description: 'Phonk crudo y pesado.',
        cover: '/caratulas/AUTOMOTIVOANTI-CELESTIAL .webp',
        trackIds: ['ph1', 'ph2', 'ph3', 'ph4', 'ph5', 'ph6', 'ph7'],
      },
      {
        id: 'nuzthemes',
        name: 'nuzthemes',
        description: 'Los temas de Nuz.',
        cover: '/caratulas/' + encodeURIComponent('Snow Strippers - Passionate highs.webp'),
        trackIds: ['nuz1', 'nuz2', 'nuz3', 'nuz4', 'nuz5', 'nuz6', 'doom1', 'nuz7', 'nuz8'],
      },
      {
        id: 'relax-time',
        name: 'relax_time',
        description: 'Para relajarte sin pensar.',
        cover: '/caratulas/' + encodeURIComponent('Плейлист для того, чтобы последний раз отдохнуть.webp'),
        trackIds: ['nuz9', 'relax2', 'relax3'],
      },
      {
        id: 'snicore',
        name: 'snicore',
        description: 'Ritmos rápidos y agresivos.',
        cover: '/caratulas/kurxedEzxmelards.webp',
        trackIds: ['sni1', 'sni2', 'sni3', 'sni4', 'sni5'],
      },
      {
        id: 'clasiccthemes',
        name: 'clasiccthemes',
        description: 'Clásicos de siempre.',
        cover: '/caratulas/' + encodeURIComponent('GoldSpandau Ballet .webp'),
        trackIds: ['classic1', 'classic2', 'classic3', 'classic4'],
      },
    ];
  }
}
