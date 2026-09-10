import { Injectable, inject, signal } from '@angular/core';
import type { Track } from '../models/track';
import { ToastService } from './toast.service';

type DownloadStatus = 'downloading' | 'downloaded' | 'error';

interface StoredAudio {
  id: string;
  blob: Blob;
  savedAt: number;
}

const DB_NAME = 'nuz-offline';
const DB_VERSION = 1;
const STORE = 'audio';

@Injectable({ providedIn: 'root' })
export class OfflineStorageService {
  readonly status = signal<Record<string, DownloadStatus>>({});
  readonly progress = signal<Record<string, number>>({});

  private readonly toast = inject(ToastService);

  private dbPromise: Promise<IDBDatabase> | null = null;
  private objectUrls = new Map<string, string>();
  private inFlight = new Map<string, Promise<void>>();

  constructor() {
    void this.init();
  }

  get isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  isDownloaded(id: string): boolean {
    return this.status()[id] === 'downloaded';
  }

  download(track: Track): Promise<void> {
    if (!this.isSupported) return Promise.resolve();

    if (this.isDownloaded(track.id)) return Promise.resolve();

    const pending = this.inFlight.get(track.id);
    if (pending) return pending;

    const promise = this.runDownload(track);
    this.inFlight.set(track.id, promise);
    return promise;
  }

  async remove(track: Track): Promise<void> {
    if (!this.isSupported) return;

    try {
      const db = await this.getDb();
      await this.deleteBlob(db, track.id);
    } catch {
      // Ignora si la base no existe; igualmente se elimina el estado local.
    }

    this.objectUrls.delete(track.id);
    this.clearTrackState(track.id);
  }

  async resolveSourceUrl(track: Track): Promise<string> {
    const cached = this.objectUrls.get(track.id);
    if (cached) return cached;

    if (!this.isSupported) return track.audioUrl;

    try {
      const db = await this.getDb();
      const stored = await this.getBlob(db, track.id);
      if (stored) {
        const url = URL.createObjectURL(stored.blob);
        this.objectUrls.set(track.id, url);
        this.status.update((prev) =>
          prev[track.id] === 'downloaded' ? prev : { ...prev, [track.id]: 'downloaded' },
        );
        return url;
      }
    } catch {
      // Si no se pudo leer la base, se reproduce desde la red.
    }

    return track.audioUrl;
  }

  private async runDownload(track: Track): Promise<void> {
    try {
      await this.fetchAndStore(track);
      this.toast.show(
        `"${track.title}" descargada para escuchar offline`,
        'success',
        track.cover,
        track.title,
      );
    } catch {
      this.toast.show(
        `No se pudo descargar "${track.title}". Reintentá más tarde`,
        'error',
        track.cover,
        track.title,
      );
    } finally {
      this.inFlight.delete(track.id);
    }
  }

  private async init(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const db = await this.getDb();
      const ids = await this.getAllIds(db);
      if (!ids.length) return;

      const statuses: Record<string, DownloadStatus> = {};
      for (const id of ids) statuses[id] = 'downloaded';
      this.status.set(statuses);
    } catch {
      // Sin IndexedDB disponible; las descargas no se muestran.
    }
  }

  private async fetchAndStore(track: Track): Promise<void> {
    this.setStatus(track.id, 'downloading');
    this.setProgress(track.id, 0);

    try {
      const res = await fetch(track.audioUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentLength = Number(res.headers.get('Content-Length')) || 0;
      const reader = res.body?.getReader();

      const blob = reader
        ? await this.readBlob(reader, contentLength, track.id)
        : await res.blob();

      const db = await this.getDb();
      await this.putBlob(db, { id: track.id, blob, savedAt: Date.now() });
      this.setStatus(track.id, 'downloaded');
      this.setProgress(track.id, 100);
    } catch {
      this.setStatus(track.id, 'error');
      this.clearProgress(track.id);
      throw new Error('No se pudo descargar la canción');
    }
  }

  private async readBlob(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    contentLength: number,
    trackId: string,
  ): Promise<Blob> {
    const chunks: BlobPart[] = [];
    let received = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value as BlobPart);
      received += value.byteLength;

      if (contentLength) {
        const pct = Math.min(99, Math.round((received / contentLength) * 100));
        this.setProgress(trackId, pct);
      }
    }

    return new Blob(chunks, { type: 'audio/mpeg' });
  }

  private setStatus(id: string, status: DownloadStatus): void {
    this.status.update((prev) => ({ ...prev, [id]: status }));
  }

  private setProgress(id: string, value: number): void {
    this.progress.update((prev) => ({ ...prev, [id]: value }));
  }

  private clearProgress(id: string): void {
    this.progress.update((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  private clearTrackState(id: string): void {
    this.status.update((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    this.clearProgress(id);
  }

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (!this.isSupported) {
          reject(new Error('IndexedDB no soportado'));
          return;
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result as IDBDatabase);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }

  private getAllIds(db: IDBDatabase): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  }

  private getBlob(db: IDBDatabase, id: string): Promise<StoredAudio | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id) as IDBRequest<StoredAudio | undefined>;
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private putBlob(db: IDBDatabase, record: StoredAudio): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private deleteBlob(db: IDBDatabase, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}