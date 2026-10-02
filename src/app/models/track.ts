export interface Chapter {
  time: number;
  title: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  duration: number;
  lyricsUrl?: string;
  videoUrl?: string;
  chapters?: Chapter[];
  blurBackground?: boolean;
  hideRhythmBars?: boolean;
  backgroundColor?: string;
  showSun?: boolean;
  showStars?: boolean;
}
