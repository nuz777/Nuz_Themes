import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
})
export class Toast {
  protected readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected openToast(toast: { id: number; route?: string }): void {
    if (!toast.route) return;
    this.toastService.dismiss(toast.id);
    void this.router.navigateByUrl(toast.route);
  }
}
