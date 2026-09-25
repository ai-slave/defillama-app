import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { assert, describe, expect, test, vi } from 'vitest'
import { getInvestorsSite, INVESTORS_SITES } from '../config'
import { getUmamiScriptAttributes } from '../umamiScript'

const TRACKER = readFileSync('public/script2.js', 'utf8')

/** Runs the real tracker as the page's script tag on `hostname` and returns the requests it sent. */
async function trackOn(hostname: string) {
	const attributes = getUmamiScriptAttributes(getInvestorsSite(hostname))
	assert(attributes)
	const fetch = vi.fn(async () => ({ json: async () => ({}) }))
	const location = new URL(`https://${hostname}/`)
	const trackerWindow = {
		screen: { width: 1280, height: 720 },
		navigator: { language: 'en' },
		location,
		localStorage: { getItem: () => null },
		document: {
			currentScript: {
				src: 'https://defillama.com/script2.js',
				getAttribute: (name: string) => attributes[name as keyof typeof attributes] ?? null
			},
			referrer: '',
			title: 'Analytics test',
			readyState: 'complete',
			addEventListener: () => {}
		},
		history: { pushState: () => {}, replaceState: () => {} },
		umami: undefined as typeof window.umami
	}
	runInNewContext(TRACKER, { window: trackerWindow, fetch, setTimeout, URL })
	await trackerWindow.umami!.track('test-click')
	await trackerWindow.umami!.identify('test-user')
	return fetch.mock.calls.length
}

describe('Umami tracker script', () => {
	test('loads no tracker until the site is resolved', () => {
		expect(getUmamiScriptAttributes(undefined)).toBeNull()
	})

	test('reports the main site and each IR site to its own website, only from its own host', () => {
		const sites = [null, INVESTORS_SITES.investors, INVESTORS_SITES.enterprise].map((site) => {
			const attributes = getUmamiScriptAttributes(site)
			assert(attributes)
			return attributes
		})
		expect(new Set(sites.map((attributes) => attributes['data-website-id'])).size).toBe(3)
		expect(sites.map((attributes) => attributes['data-domains'])).toEqual([
			'defillama.com',
			'investors.defillama.com',
			'enterprise.defillama.com'
		])
	})

	// The page view on load plus the tracked event and the identify call.
	test.each([
		['defillama.com', 3],
		['investors.defillama.com', 3],
		['enterprise.defillama.com', 3],
		['ir-staging.llama.fi', 0],
		['localhost', 0]
	] as const)('sends tracker requests from %s: %i', async (hostname, requests) => {
		expect(await trackOn(hostname)).toBe(requests)
	})
})
