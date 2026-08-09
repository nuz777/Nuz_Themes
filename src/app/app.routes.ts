import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  { path: 'playlists', loadComponent: () => import('./pages/playlists/playlists').then((m) => m.PlaylistsPage) },
  { path: 'playlist/:id', loadComponent: () => import('./pages/playlist/playlist').then((m) => m.PlaylistPage) },
  { path: 'track/:id', loadComponent: () => import('./pages/track/track').then((m) => m.TrackPage) },
  { path: '**', redirectTo: '' },
];
