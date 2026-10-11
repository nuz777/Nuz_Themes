export interface Chapter {
  time: number;
  title: string;
}

export interface TrackQualityUrls {
  baja?: string;
  media?: string;
  alta?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  duration: number;
  qualityUrls?: TrackQualityUrls;
  lyricsUrl?: string;
  videoUrl?: string;
  chapters?: Chapter[];
  blurBackground?: boolean;
  hideRhythmBars?: boolean;
  backgroundColor?: string;
  showSun?: boolean;
  showStars?: boolean;
  showSnow?: boolean;
}

