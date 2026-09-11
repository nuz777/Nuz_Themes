import { Component, inject, input } from '@angular/core';
import type { Track } from '../../models/track';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-download-button',
  imports: [],
  templateUrl: './download-button.html',
})
export class DownloadButton {
  readonly track = input.required<Track>();
  protected readonly offline = inject(OfflineStorageService);
  private readonly toast = inject(ToastService);

  protected toggle(): void {
    const status = this.offline.status()[this.track().id];
    if (status === 'downloaded') {
      void this.offline.remove(this.track());
    } else if (status !== 'downloading') {
      this.toast.requestPermission();
      void this.offline.download(this.track());
    }
  }

  protected statusLabel(): string {
    const status = this.offline.status()[this.track().id];
    if (status === 'downloading') return 'Descargando...';
    if (status === 'downloaded') return 'Descargada. Clic para eliminar';
    if (status === 'error') return 'Error. Clic para reintentar';
    return 'Descargar a tu dispositivo';
  }
}