import { describe, expect, test } from 'vitest'
import { YIELDS_V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchTrendsFromNetwork } from '../fetchers'

const http = installFixtureFetch()
const TRENDS = `${YIELDS_V2_SERVER_URL}/v2/earn/trends`
const unavailable = () => new Response('busy', { status: 503 })

describe('Yields v2 network fetchers', () => {
	test('unwraps the data envelope', async () => {
		http.serve({ [TRENDS]: { data: [{ pool: 'pool-1' }] } })

		await expect(fetchTrendsFromNetwork({ timeout: 1000 })).resolves.toEqual([{ pool: 'pool-1' }])
	})

	// The snapshot build asks for one more attempt so two upstream blips do not fail a page build.
	test('survives two failed attempts only with the snapshot extra retry', async () => {
		http.serveInOrder(TRENDS, [unavailable, unavailable], { data: [{ pool: 'pool-1' }] })
		await expect(fetchTrendsFromNetwork({ extraRetry: true, timeout: 1000 })).resolves.toEqual([{ pool: 'pool-1' }])

		http.serveInOrder(TRENDS, [unavailable, unavailable], { data: [{ pool: 'pool-1' }] })
		await expect(fetchTrendsFromNetwork({ timeout: 1000 })).rejects.toThrow('[503]')
	})
})
