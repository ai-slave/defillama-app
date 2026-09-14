import { describe, expect, test, vi } from 'vitest'
import {
	dashboardPathsToUrls,
	normalizeResearchCachePaths,
	purgeCloudflareResearchUrls,
	researchPathsToUrls
} from '~/server/cloudflarePurge'

describe('research Cloudflare purge helpers', () => {
	test('normalizes only research paths', () => {
		expect(
			normalizeResearchCachePaths([
				'/research',
				'/research/report/story?utm=1',
				'/protocol/aave',
				'https://evil.example/research',
				'/research/report/story#section'
			])
		).toEqual(['/research', '/research/report/story'])
	})

	test('purges Cloudflare by exact public urls', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))

		const result = await purgeCloudflareResearchUrls(['/research', '/research/report/story'], {
			env: {
				...process.env,
				CF_PURGE_CACHE_AUTH: 'token',
				CF_ZONE: 'zone',
				NEXT_PUBLIC_SITE_URL: 'https://defillama.test'
			},
			fetchImpl,
			logger: { log: vi.fn() }
		})

		expect(result).toEqual({
			status: 'purged',
			urls: ['https://defillama.test/research', 'https://defillama.test/research/report/story']
		})
		expect(fetchImpl).toHaveBeenCalledWith('https://api.cloudflare.com/client/v4/zones/zone/purge_cache', {
			body: JSON.stringify({
				files: ['https://defillama.test/research', 'https://defillama.test/research/report/story']
			}),
			headers: {
				Authorization: 'Bearer token',
				'Content-Type': 'application/json'
			},
			method: 'POST'
		})
	})

	test('uses the configured site url when building purge urls', () => {
		expect(
			researchPathsToUrls(['/research/report/story'], {
				...process.env,
				SITE_URL: 'https://www.defillama.test'
			})
		).toEqual(['https://www.defillama.test/research/report/story'])
	})
})

describe('dashboard Cloudflare purge helpers', () => {
	const env = {
		...process.env,
		NEXT_PUBLIC_SITE_URL: 'https://defillama.test'
	}

	test('builds page and stream urls for id, slug, and previous slug', () => {
		expect(dashboardPathsToUrls({ id: 'dash-1', slug: 'yield-overview', previousSlug: 'old-yield' }, env)).toEqual([
			'https://defillama.test/pro/dash-1',
			'https://defillama.test/pro/embed/dash-1',
			'https://defillama.test/api/dynamic/pro-dashboard/dash-1/stream',
			'https://defillama.test/api/og/pro/dash-1',
			'https://defillama.test/api/og/pro/dash-1?variant=thumb',
			'https://defillama.test/pro/yield-overview',
			'https://defillama.test/pro/embed/yield-overview',
			'https://defillama.test/api/dynamic/pro-dashboard/yield-overview/stream',
			'https://defillama.test/api/og/pro/yield-overview',
			'https://defillama.test/api/og/pro/yield-overview?variant=thumb',
			'https://defillama.test/pro/old-yield',
			'https://defillama.test/pro/embed/old-yield',
			'https://defillama.test/api/dynamic/pro-dashboard/old-yield/stream',
			'https://defillama.test/api/og/pro/old-yield',
			'https://defillama.test/api/og/pro/old-yield?variant=thumb'
		])
	})

	test('dedupes keys and skips empty slugs', () => {
		expect(dashboardPathsToUrls({ id: 'dash-1', slug: 'dash-1', previousSlug: null }, env)).toEqual([
			'https://defillama.test/pro/dash-1',
			'https://defillama.test/pro/embed/dash-1',
			'https://defillama.test/api/dynamic/pro-dashboard/dash-1/stream',
			'https://defillama.test/api/og/pro/dash-1',
			'https://defillama.test/api/og/pro/dash-1?variant=thumb'
		])
	})

	test('purges next data payloads when a build id is known', () => {
		expect(dashboardPathsToUrls({ id: 'dash-1', slug: 'yield-overview' }, env, 'build-123')).toEqual([
			'https://defillama.test/pro/dash-1',
			'https://defillama.test/pro/embed/dash-1',
			'https://defillama.test/api/dynamic/pro-dashboard/dash-1/stream',
			'https://defillama.test/api/og/pro/dash-1',
			'https://defillama.test/api/og/pro/dash-1?variant=thumb',
			'https://defillama.test/_next/data/build-123/pro/dash-1.json',
			'https://defillama.test/_next/data/build-123/pro/embed/dash-1.json',
			'https://defillama.test/pro/yield-overview',
			'https://defillama.test/pro/embed/yield-overview',
			'https://defillama.test/api/dynamic/pro-dashboard/yield-overview/stream',
			'https://defillama.test/api/og/pro/yield-overview',
			'https://defillama.test/api/og/pro/yield-overview?variant=thumb',
			'https://defillama.test/_next/data/build-123/pro/yield-overview.json',
			'https://defillama.test/_next/data/build-123/pro/embed/yield-overview.json'
		])
	})
})
