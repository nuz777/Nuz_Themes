import { Component, inject, input, computed } from '@angular/core';
import type { Track } from '../../models/track';
import { FavoritesService } from '../../services/favorites.service';

@Component({
  selector: 'app-favorite-button',
  imports: [],
  templateUrl: './favorite-button.html',
})
export class FavoriteButton {
  readonly track = input.required<Track>();
  private readonly favorites = inject(FavoritesService);

  protected readonly active = computed(() => this.favorites.isFavorite(this.track().id));

  protected toggle(): void {
    this.favorites.toggle(this.track());
  }

  protected label(): string {
    return this.active() ? 'Quitar de favoritos' : 'Agregar a favoritos';
  }
}
