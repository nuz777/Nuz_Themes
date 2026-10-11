export type TrackRelativePath = string
export type TrackAuthors = string[]
export type TrackAlbums = string[]
export type Date = `${string}-${string}-${string}`

export interface RepositoryContent {
    namespace: string
    tracks: TrackRelativePath[]
}

export interface Repository {
  url: string,
  data: RepositoryContent
}

export interface TrackPresentation {
  cover: string
  lyrics?: string
}

export interface TrackSourceVideo {
  source: string
}

export interface TrackTimeline {
  timestamp: number,
  title: string,
}

export interface TrackSource {
  low: string
  medium?: string
  high?: string
  video?: TrackSourceVideo
}

// FUTURE: remplaces TrackSourceVideo and "blurBackground", "hide*", "show*"
export interface TrackTheme {
  
}

export interface Track {
  title: string
  authors: TrackAuthors,
  albums: TrackAlbums,
  date: Date,
  presentation: TrackPresentation,
  source: TrackSource,
  timeline?: TrackTimeline[]
  theme?: TrackTheme
}
