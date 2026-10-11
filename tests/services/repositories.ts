import { describe, it, expect } from "vitest"
import { getRepository, getRepositoryPage, getTrack } from "@/services/repositories"

// need server running
const BASE_URL = "http://localhost:4200"

describe('repositories', () => {
  it('success load repository', async () => {
    const repository = await getRepository(`${BASE_URL}/repositories/default.json`)

    expect(repository.data.namespace).toBe("nuz-favorites")
    expect(repository.data.tracks[0]).toBe("anar/ogame")
  });

  it("load a track from repository", async () => {
    const repository = await getRepository(`${BASE_URL}/repositories/default.json`)
    const track = await getTrack(repository, repository.data.tracks[0])

    expect(repository.data.namespace).toBe("nuz-favorites")
    expect(track.title).toBe("OGAME")
    expect(track.authors[0]).toBe("Anar")
  })

  it("load a page from repository", async () => {
    const repository = await getRepository(`${BASE_URL}/repositories/default.json`)
    const page2 = await getRepositoryPage(repository, 1)
    const track = await getTrack(repository, page2[0])

    expect(repository.data.namespace).toBe("nuz-favorites")
    expect(track.title).toBe("Keep Their Heads Ringin")
    expect(track.authors[0]).toBe("Dr. Dre")
  })
});
