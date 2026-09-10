import { describe, expect, test } from 'vitest'
import {
	getProtocolSitemapRoutes,
	resolveProtocolFeatureRouteFromMetadata
} from '~/containers/ProtocolOverview/server/routes'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

// xstocks: TVL adapter retired (module: dummy.js upstream => no tvl flag), RWA platform declared.
// okx: live TVL adapter AND a declared RWA platform — both tabs must survive.
// spiko: live TVL, no RWA platform.
const metadataCache = {
	protocolMetadata: {
		'6378': { name: 'xstocks', displayName: 'xStocks', rwaPlatformSlug: 'xstocks' },
		'2272': { name: 'okx', displayName: 'OKX', tvl: true, rwaPlatformSlug: 'okx' },
		'4980': { name: 'spiko', displayName: 'Spiko', tvl: true, fees: true }
	},
	protocolRouteIdBySlug: { xstocks: '6378', okx: '2272', spiko: '4980' },
	cexRouteIdBySlug: {}
} as unknown as MetadataCache

const resolveTvl = (protocol: string) =>
	resolveProtocolFeatureRouteFromMetadata({
		cexRoutePrefix: 'cex/assets',
		hasMetric: (metadata) => Boolean(metadata.tvl),
		metadataCache,
		protocol,
		routePrefix: 'protocol/tvl',
		rwaPlatformRedirect: true
	})

const resolveRwa = (protocol: string) =>
	resolveProtocolFeatureRouteFromMetadata({
		hasMetric: (metadata) => Boolean(metadata.rwaPlatformSlug),
		metadataCache,
		protocol,
		routePrefix: 'protocol/rwa'
	})

describe('RWA platform tab and TVL retirement', () => {
	test('routes the RWA tab for a protocol the sheet declares', () => {
		expect(resolveRwa('xstocks')).toMatchObject({ type: 'route' })
		expect(resolveRwa('okx')).toMatchObject({ type: 'route' })
	})

	test('404s the RWA tab for a protocol with no declared platform', () => {
		expect(resolveRwa('spiko')).toBeNull()
	})

	test('redirects a retired TVL page to the platform page instead of 404ing', () => {
		expect(resolveTvl('xstocks')).toEqual({ type: 'redirect', destination: '/rwa/platform/xstocks' })
	})

	test('leaves a live TVL page alone even when the protocol is also an RWA platform', () => {
		// OKX TVL is exchange assets; the RWA platform page measures something else entirely.
		expect(resolveTvl('okx')).toMatchObject({ type: 'route' })
	})

	test('still 404s a retired TVL page that has no RWA platform', () => {
		const noPlatform = {
			...metadataCache,
			protocolMetadata: { '6378': { name: 'xstocks', displayName: 'xStocks' } }
		} as unknown as MetadataCache
		expect(
			resolveProtocolFeatureRouteFromMetadata({
				hasMetric: (metadata) => Boolean(metadata.tvl),
				metadataCache: noPlatform,
				protocol: 'xstocks',
				routePrefix: 'protocol/tvl',
				rwaPlatformRedirect: true
			})
		).toBeNull()
	})

	test('does not redirect on tabs that have not opted in', () => {
		expect(
			resolveProtocolFeatureRouteFromMetadata({
				hasMetric: (metadata) => Boolean(metadata.tvl),
				metadataCache,
				protocol: 'xstocks',
				routePrefix: 'protocol/tvl'
			})
		).toBeNull()
	})

	test('lists RWA tab routes in the sitemap and omits the retired TVL route', () => {
		const routes = getProtocolSitemapRoutes(metadataCache)
		expect(routes).toContain('protocol/rwa/xstocks')
		expect(routes).toContain('protocol/rwa/okx')
		expect(routes).not.toContain('protocol/rwa/spiko')
		expect(routes).not.toContain('protocol/tvl/xstocks')
		expect(routes).toContain('protocol/tvl/okx')
	})
})
