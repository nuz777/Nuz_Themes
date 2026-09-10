import { Component, inject } from '@angular/core';
import { PiPService } from '../../services/pip.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-pip-button',
  imports: [],
  templateUrl: './pip-button.html',
})
export class PipButton {
  protected readonly pip = inject(PiPService);
  private readonly toast = inject(ToastService);

  protected async toggle(): Promise<void> {
    if (!this.pip.supported) {
      this.toast.show(
        'Tu navegador no soporta el reproductor flotante fuera de la ventana.',
        'error',
      );
      return;
    }

    if (this.pip.active()) {
      await this.pip.exit();
      return;
    }

    try {
      await this.pip.enter();
    } catch (error) {
      console.error('PiP error:', error);
      const message =
        error instanceof Error ? error.message : JSON.stringify(error) ?? String(error);
      this.toast.show(`No se pudo abrir el reproductor flotante: ${message}`, 'error');
    }
  }

  protected label(): string {
    return this.pip.active() ? 'Cerrar reproductor flotante' : 'Reproductor flotante';
  }
}