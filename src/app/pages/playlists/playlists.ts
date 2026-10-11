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
  protected readonly isCoverCustom = signal(false);
  protected readonly coverRemoved = signal(false);
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

  protected closeUploadModal(force = false): void {
    if (this.isSaving() && !force) return;
    this.resetUploadForm();
    this.uploadModalOpen.set(false);
  }

  protected triggerAudioSelect(): void {
    this.audioFileInput?.nativeElement.click();
  }

  protected triggerCoverSelect(): void {
    if (this.coverFileInput?.nativeElement) {
      this.coverFileInput.nativeElement.value = '';
    }
    this.coverFileInput?.nativeElement.click();
  }

  protected async onAudioSelected(event: Event): Promise<void> {
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

    // Si el usuario no ha elegido una carátula personalizada manualmente y no la ha quitado, extraer la incrustada
    if (!this.isCoverCustom() && !this.coverRemoved()) {
      try {
        const embeddedBlob = await this.tracksService.extractEmbeddedCover(file);
        if (embeddedBlob && !this.isCoverCustom() && !this.coverRemoved()) {
          const coverFile = new File([embeddedBlob], 'cover.jpg', { type: embeddedBlob.type || 'image/jpeg' });
          this.selectedCoverFile.set(coverFile);
          const reader = new FileReader();
          reader.onload = () => {
            this.coverPreview.set(reader.result as string);
          };
          reader.readAsDataURL(embeddedBlob);
        }
      } catch {
        // Continuar con carátula predeterminada si no tiene carátula incrustada
      }
    }
  }

  protected onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadError.set(null);
    this.isCoverCustom.set(true);
    this.coverRemoved.set(false);
    this.selectedCoverFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.coverPreview.set(reader.result as string);
    };
    reader.onerror = () => {
      try {
        this.coverPreview.set(URL.createObjectURL(file));
      } catch {
        // ignore
      }
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  protected removeCover(): void {
    this.isCoverCustom.set(false);
    this.coverRemoved.set(true);
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

    const title = this.trackTitle().trim() || file.name.replace(/\.[^/.]+$/, '').trim() || 'Pista de audio';

    this.isSaving.set(true);
    this.uploadError.set(null);

    try {
      await Promise.race([
        this.tracksService.addUserTrack({
          file,
          cover: this.selectedCoverFile(),
          noCover: this.coverRemoved(),
          title,
          artist: this.trackArtist().trim() || 'Artista desconocido',
          album: this.trackAlbum().trim() || 'Música local',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout al guardar canción')), 20000)),
      ]);
      this.closeUploadModal(true);
    } catch (err) {
      console.error('Error al guardar canción:', err);
      this.uploadError.set('Ocurrió un error al procesar el archivo. Intenta de nuevo.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private resetUploadForm(): void {
    this.selectedAudioFile.set(null);
    this.selectedCoverFile.set(null);
    this.coverPreview.set(null);
    this.isCoverCustom.set(false);
    this.coverRemoved.set(false);
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
