import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'success' | 'error';
  cover?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private nextId = 0;

  show(text: string, kind: Toast['kind'] = 'success', cover?: string, title?: string): void {
    const id = ++this.nextId;
    this.toasts.update((prev) => [...prev, { id, text, kind, cover }]);
    this.notifyNative(title, text, cover);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number): void {
    this.toasts.update((prev) => prev.filter((t) => t.id !== id));
  }

  requestPermission(): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    void Notification.requestPermission().catch(() => undefined);
  }

  private notifyNative(title: string | undefined, body: string, cover: string | undefined): void {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification(title || 'Nuz_Themes', {
        body,
        icon: cover,
      });
    } catch {
      // Algunos navegadores bloquean la notificación; se ignora.
    }
  }
}