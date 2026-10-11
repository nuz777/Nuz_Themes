import type { Repository, RepositoryContent, TrackRelativePath, Track } from "./types"

export async function getRepository(url: string): Promise<Repository> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`failed to fetch repositoy: ${response.url}`)

  const data: RepositoryContent = await response.json()
  return { url, data }
}

export async function getTrack(repository: Repository, url: TrackRelativePath): Promise<Track> {
  const baseUrl = repository.url.substring(0, repository.url.lastIndexOf("/"))
  const response = await fetch(`${baseUrl}/tracks/${url}.json`)
  if (!response.ok) throw new Error(`failed to fetch track: ${response.url}`)

  const data: Track = await response.json()
  return data
}

const PAGE_SIZE = 9

export async function getRepositoryPage(repository: Repository, page: number): Promise<TrackRelativePath[]> {
  const start = page * PAGE_SIZE
  const paths = repository.data.tracks.slice(start, start + PAGE_SIZE)

  return paths
}
