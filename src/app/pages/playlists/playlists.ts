import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TracksService } from '../../services/tracks.service';
import { PlaylistCard } from '../../components/playlist-card/playlist-card';
import { TrackList } from '../../components/track-list/track-list';

@Component({
  selector: 'app-playlists-page',
  imports: [PlaylistCard, TrackList],
  templateUrl: './playlists.html',
})
export class PlaylistsPage {
  @ViewChild('audioFileInput') private audioFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('coverFileInput') private coverFileInput?: ElementRef<HTMLInputElement>;

  protected readonly tracksService = inject(TracksService);
  private readonly router = inject(Router);

  protected readonly creating = signal(false);
  protected readonly uploadModalOpen = signal(false);
  protected readonly isSaving = signal(false);

  // Form signals for uploading music
  protected readonly selectedAudioFile = signal<File | null>(null);
  protected readonly selectedCoverFile = signal<File | null>(null);
  protected readonly coverPreview = signal<string | null>(null);
  protected readonly trackTitle = signal('');
  protected readonly trackArtist = signal('');
  protected readonly trackAlbum = signal('');
  protected readonly uploadError = signal<string | null>(null);

  protected readonly userTracks = computed(() => this.tracksService.getUserTracks());

  protected createPlaylist(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem('playlistName');
    if (!(input instanceof HTMLInputElement)) return;

    const playlist = this.tracksService.createPlaylist(input.value);
    if (!playlist) return;
    this.creating.set(false);
    void this.router.navigate(['/playlist', playlist.id]);
  }

  protected openUploadModal(): void {
    this.resetUploadForm();
    this.uploadModalOpen.set(true);
  }

  protected closeUploadModal(): void {
    if (this.isSaving()) return;
    this.resetUploadForm();
    this.uploadModalOpen.set(false);
  }

  protected triggerAudioSelect(): void {
    this.audioFileInput?.nativeElement.click();
  }

  protected triggerCoverSelect(): void {
    this.coverFileInput?.nativeElement.click();
  }

  protected onAudioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.selectedAudioFile.set(file);
    this.uploadError.set(null);

    // Default title from file name if empty
    if (!this.trackTitle().trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
      this.trackTitle.set(baseName || file.name);
    }
  }

  protected onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.uploadError.set('El archivo de carátula debe ser una imagen');
      return;
    }

    this.selectedCoverFile.set(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.coverPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  protected removeCover(): void {
    this.selectedCoverFile.set(null);
    this.coverPreview.set(null);
    if (this.coverFileInput?.nativeElement) {
      this.coverFileInput.nativeElement.value = '';
    }
  }

  protected formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  protected async saveUserTrack(): Promise<void> {
    const file = this.selectedAudioFile();
    if (!file) {
      this.uploadError.set('Por favor, selecciona un archivo de audio');
      return;
    }

    const title = this.trackTitle().trim() || file.name.replace(/\.[^/.]+$/, '').trim();
    if (!title) {
      this.uploadError.set('El título de la canción es obligatorio');
      return;
    }

    this.isSaving.set(true);
    this.uploadError.set(null);

    try {
      await this.tracksService.addUserTrack({
        file,
        cover: this.selectedCoverFile(),
        title,
        artist: this.trackArtist().trim() || 'Artista desconocido',
        album: this.trackAlbum().trim() || 'Música local',
      });
      this.closeUploadModal();
    } catch {
      this.uploadError.set('Ocurrió un error al guardar la canción. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private resetUploadForm(): void {
    this.selectedAudioFile.set(null);
    this.selectedCoverFile.set(null);
    this.coverPreview.set(null);
    this.trackTitle.set('');
    this.trackArtist.set('');
    this.trackAlbum.set('');
    this.uploadError.set(null);
    if (this.audioFileInput?.nativeElement) {
      this.audioFileInput.nativeElement.value = '';
    }
    if (this.coverFileInput?.nativeElement) {
      this.coverFileInput.nativeElement.value = '';
    }
  }
}
