import { afterEach, expect, test, vi } from 'vitest'
import { fetchDailyBrief } from '../api'
import sample from './sample.json'

const http = vi.hoisted(() => ({ response: null as Response | null }))
vi.mock('~/utils/http-client', () => ({ fetchWithPoolingOnServer: async () => http.response }))

afterEach(() => {
	http.response = null
})

test('a brief with sections is returned as the server sent it', async () => {
	http.response = Response.json(sample)
	expect(await fetchDailyBrief()).toEqual(sample)
})

test('a missing, empty or failed brief is null, so the homepage shows no empty card', async () => {
	http.response = new Response(null, { status: 404 })
	expect(await fetchDailyBrief()).toBeNull()
	http.response = Response.json({ ...sample, sections: [] })
	expect(await fetchDailyBrief()).toBeNull()
	http.response = new Response('<html>', { status: 200 })
	expect(await fetchDailyBrief()).toBeNull()
})
