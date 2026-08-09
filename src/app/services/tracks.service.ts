import { Injectable, signal } from '@angular/core';
import type { Track } from '../models/track';

export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string;
  trackIds: string[];
}

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/300/300?grayscale`;

@Injectable({ providedIn: 'root' })
export class TracksService {
  readonly tracks = signal<Track[]>([]);
  readonly playlists = signal<Playlist[]>([]);

  constructor() {
    this.tracks.set(this.buildTracks());
    this.playlists.set(this.buildPlaylists());
    this.preloadCovers();
  }

  private preloadCovers(): void {
    if (typeof Image === 'undefined') return;
    const urls = new Set<string>();
    for (const track of this.tracks()) urls.add(track.cover);
    for (const playlist of this.playlists()) urls.add(playlist.cover);
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }

  getTrack(id: string): Track | undefined {
    return this.tracks().find((t) => t.id === id);
  }

  getPlaylist(id: string): Playlist | undefined {
    return this.playlists().find((p) => p.id === id);
  }

  getPlaylistTracks(id: string): Track[] {
    const playlist = this.getPlaylist(id);
    if (!playlist) return [];
    return playlist.trackIds
      .map((tid) => this.getTrack(tid))
      .filter((t): t is Track => !!t);
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
        duration: 0,
      },
      {
        id: 'classic1',
        title: 'Gold',
        artist: 'Spandau Ballet',
        album: 'Gold',
        cover: '/caratulas/' + encodeURIComponent('GoldSpandau Ballet .webp'),
        audioUrl: '/music/' + encodeURIComponent('Gold; Spandau Ballet (Español - Inglés).mp3'),
        duration: 0,
      },
      {
        id: 'classic2',
        title: 'The Less I Know The Better',
        artist: 'Tame Impala',
        album: 'Currents',
        cover: '/caratulas/' + encodeURIComponent('TameImpala - TheLessIKnowTheBetter.webp'),
        audioUrl: '/music/' + encodeURIComponent('Tame Impala - The Less I Know The Better (Audio).mp3'),
        duration: 0,
      },
      {
        id: 'nuz1',
        title: 'Passionate highs',
        artist: 'Snow Strippers',
        album: 'Snow Strippers',
        cover: '/caratulas/' + encodeURIComponent('Snow Strippers - Passionate highs.webp'),
        audioUrl: '/music/' + encodeURIComponent('Snow Strippers - Passionate highs (slowed + reverb).mp3'),
        duration: 0,
      },
      {
        id: 'nuz2',
        title: 'Stuck Next To You',
        artist: 'Tiishe',
        album: 'Tiishe',
        cover: '/caratulas/' + encodeURIComponent('StuckNextToYo -Tiishe.webp'),
        audioUrl: '/music/' + encodeURIComponent('Stuck Next To You - Tiishe [Slowed] (prod.voidrave99).mp3'),
        duration: 0,
      },
      {
        id: 'nuz3',
        title: 'lose me',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/lose_me.webp',
        audioUrl: '/music/' + encodeURIComponent('lose me (slowed).mp3'),
        duration: 0,
      },
      {
        id: 'sni1',
        title: 'Kurxxed Ultimate',
        artist: 'Kurxxed Emeraldz',
        album: 'Kurxxed Emeraldz',
        cover: '/caratulas/kurxedEzxmelards.webp',
        audioUrl: '/music/' + encodeURIComponent('__Kurxxed Ultimate__ Kurxxed Emeraldz Mashup.mp3'),
        duration: 0,
      },
      {
        id: 'sni2',
        title: 'chainsaw',
        artist: 'maple',
        album: 'maple',
        cover: '/caratulas/chaisaw.webp',
        audioUrl: '/music/' + encodeURIComponent('chainsaww-maple ft. slaywitme(siouxxie)(slowed).mp3'),
        duration: 0,
      },
      {
        id: 'sni3',
        title: 'so bitter',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/sobitter.webp',
        audioUrl: '/music/' + encodeURIComponent('so bitter (super slowed).mp3'),
        duration: 0,
      },
      {
        id: 'ph1',
        title: 'AUTOMOTIVO ANTI-CELESTIAL',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/AUTOMOTIVOANTI-CELESTIAL .webp',
        audioUrl: '/music/' + encodeURIComponent('AUTOMOTIVO ANTI-CELESTIAL.mp3'),
        duration: 0,
      },
      {
        id: 'classic3',
        title: 'Take Me to Your Heart',
        artist: 'Michael Learns to Rock',
        album: 'Take Me to Your Heart',
        cover: '/caratulas/takemetoyourheart.webp',
        audioUrl: '/music/' + encodeURIComponent('Take Me to Your Heart (Autumn Leaves Mix).mp3'),
        duration: 0,
      },
      {
        id: 'anim1',
        title: 'Tokyo Reggie',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/TokyoReggie.webp',
        audioUrl: '/music/' + encodeURIComponent('Tokyo Reggie.mp3'),
        duration: 0,
      },
      {
        id: 'nuz4',
        title: 'Russian Car Driver',
        artist: 'OST',
        album: 'Russian Car Driver HD',
        cover: '/caratulas/russiandriver.webp',
        audioUrl: '/music/' + encodeURIComponent('Russian Car Driver HD OST - Opening Music (Without any background noises).mp3'),
        duration: 0,
      },
      {
        id: 'nuz5',
        title: 'Brooklyn Blood',
        artist: 'Nuz',
        album: 'Nuz',
        cover: '/caratulas/' + encodeURIComponent('𝐁𝐫𝐨𝐨𝐤𝐥𝐲𝐧𝐁𝐥𝐨𝐨𝐝𝐏𝐨𝐩𝐗𝐕𝐚𝐜𝐚𝐭𝐢𝐨𝐧𝐁𝐢𝐛𝐥𝐞𝐒𝐜𝐡𝐨𝐨𝐥.webp'),
        audioUrl: '/music/' + encodeURIComponent('𝐁𝐫𝐨𝐨𝐤𝐥𝐲𝐧 𝐁𝐥𝐨𝐨𝐝 𝐏𝐨𝐩 𝐗 𝐕𝐚𝐜𝐚𝐭𝐢𝐨𝐧 𝐁𝐢𝐛𝐥𝐞 𝐒𝐜𝐡𝐨𝐨𝐥 (𝐒𝐥𝐨𝐰𝐞𝐝).mp3'),
        duration: 0,
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
        trackIds: ['local1', 'anim1'],
      },
      {
        id: 'phonk',
        name: 'phonk',
        description: 'Phonk crudo y pesado.',
        cover: '/caratulas/AUTOMOTIVOANTI-CELESTIAL .webp',
        trackIds: ['ph1'],
      },
      {
        id: 'nuzthemes',
        name: 'nuzthemes',
        description: 'Los temas de Nuz.',
        cover: '/caratulas/' + encodeURIComponent('Snow Strippers - Passionate highs.webp'),
        trackIds: ['nuz1', 'nuz2', 'nuz3', 'nuz4', 'nuz5'],
      },
      {
        id: 'snicore',
        name: 'snicore',
        description: 'Ritmos rápidos y agresivos.',
        cover: '/caratulas/kurxedEzxmelards.webp',
        trackIds: ['sni1', 'sni2', 'sni3'],
      },
      {
        id: 'clasiccthemes',
        name: 'clasiccthemes',
        description: 'Clásicos de siempre.',
        cover: '/caratulas/' + encodeURIComponent('GoldSpandau Ballet .webp'),
        trackIds: ['classic1', 'classic2', 'classic3'],
      },
    ];
  }
}
