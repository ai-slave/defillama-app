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

describe('RWA platform tab and TVL retirement', () => {
	test('redirects a retired TVL page to the platform page instead of 404ing', () => {
		// Older metadata artifacts carry only the declared platform slug, so it remains a redirect fallback.
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

	test('lists the protocol page and omits noindex RWA and TVL tabs', () => {
		const routes = getProtocolSitemapRoutes(metadataCache)
		expect(routes).toEqual(expect.arrayContaining(['protocol/xstocks', 'protocol/okx', 'protocol/spiko']))
		expect(routes).not.toContain('protocol/rwa/xstocks')
		expect(routes).not.toContain('protocol/rwa/okx')
		expect(routes).not.toContain('protocol/rwa/spiko')
		expect(routes).not.toContain('protocol/tvl/xstocks')
		expect(routes).not.toContain('protocol/tvl/okx')
	})
})

// OpenEden declares only the parent row in the sheet, but the TVL adapters live on the children.
// The redirect map covers both; the tab map covers only the parent.
const openEdenCache = {
	protocolMetadata: {
		'parent#openeden': {
			name: 'openeden',
			displayName: 'OpenEden',
			rwaPlatformSlug: 'openeden',
			rwaPlatformRedirectSlug: 'openeden'
		},
		'3057': { name: 'openeden-tbill', displayName: 'OpenEden TBILL', rwaPlatformRedirectSlug: 'openeden' },
		'5995': { name: 'openeden-usdo', displayName: 'OpenEden USDO', tvl: true, rwaPlatformRedirectSlug: 'openeden' }
	},
	protocolRouteIdBySlug: {
		openeden: 'parent#openeden',
		'openeden-tbill': '3057',
		'openeden-usdo': '5995'
	},
	cexRouteIdBySlug: {}
} as unknown as MetadataCache

const resolveChildTvl = (protocol: string) =>
	resolveProtocolFeatureRouteFromMetadata({
		hasMetric: (metadata) => Boolean(metadata.tvl),
		metadataCache: openEdenCache,
		protocol,
		routePrefix: 'protocol/tvl',
		rwaPlatformRedirect: true
	})

describe('child protocols of a declared RWA platform', () => {
	test('redirects a retired child TVL page to the parent platform page', () => {
		expect(resolveChildTvl('openeden-tbill')).toEqual({ type: 'redirect', destination: '/rwa/platform/openeden' })
	})

	test('leaves a child with a live TVL adapter routing normally', () => {
		expect(resolveChildTvl('openeden-usdo')).toMatchObject({ type: 'route' })
	})

	test('keeps noindex RWA and TVL tabs out of the sitemap', () => {
		const routes = getProtocolSitemapRoutes(openEdenCache)
		expect(routes).toEqual(
			expect.arrayContaining(['protocol/openeden', 'protocol/openeden-usdo', 'protocol/openeden-tbill'])
		)
		expect(routes).not.toContain('protocol/rwa/openeden')
		expect(routes).not.toContain('protocol/rwa/openeden-tbill')
		expect(routes).not.toContain('protocol/tvl/openeden-tbill')
		expect(routes).not.toContain('protocol/tvl/openeden-usdo')
	})
})
