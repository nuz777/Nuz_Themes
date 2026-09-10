import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TracksService } from '../../services/tracks.service';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { TrackList } from '../../components/track-list/track-list';

@Component({
  selector: 'app-downloads-page',
  imports: [TrackList, RouterLink],
  templateUrl: './downloads.html',
})
export class DownloadsPage {
  protected readonly tracksService = inject(TracksService);
  protected readonly offline = inject(OfflineStorageService);

  protected readonly tracks = computed(() =>
    this.tracksService.tracks().filter((t) => this.offline.isDownloaded(t.id)),
  );

  protected readonly downloadingTracks = computed(() =>
    this.tracksService.tracks().filter((t) => this.offline.status()[t.id] === 'downloading'),
  );
}