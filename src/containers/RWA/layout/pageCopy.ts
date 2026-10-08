import { definitions } from '../definitions'
import type { RWAPageKind } from './pageLayout'

/**
 * What each /rwa page calls itself: its title, description and canonical (one per page kind), and its h1. The titles
 * and descriptions are the ones search has indexed and the SEO work builds on: change one only on purpose. An overview
 * or scope page heads with its headline metric, an entity page with its name (the platform page pattern).
 */

type RWAPageScope = { name: string; slug: string }
export type RWAPageMeta = { title: string; description: string; canonicalUrl: string }

const SUFFIX = ' - DefiLlama'
const DASHBOARD = ` Dashboard & Analytics${SUFFIX}`
const SPOT_METRICS = 'Compare Active AUM, Onchain AUM, DeFi Active TVL, and utilization.'

/** `indexDescription`: a platform page reads its description from the platforms index when it has one. */
export function getRwaPageMeta(
	kind: RWAPageKind,
	scope: RWAPageScope | null,
	indexDescription?: string | null
): RWAPageMeta {
	const name = scope?.name ?? ''
	const slug = scope?.slug ?? ''
	switch (kind) {
		case 'overview':
			return {
				title: `Real World Assets (RWA)${DASHBOARD}`,
				description:
					'Track Real World Assets (RWA) tokenization on-chain. View tokenized treasuries, private credit, real estate, and commodities. RWA AUM, yields, and adoption analytics across all blockchains.',
				canonicalUrl: '/rwa'
			}
		case 'chain':
			return {
				title: `${name} RWA${DASHBOARD}`,
				description: `Track RWA adoption on ${name}. ${SPOT_METRICS}`,
				canonicalUrl: `/rwa/chain/${slug}`
			}
		case 'category':
			return {
				title: `${name} RWA${DASHBOARD}`,
				description: `Track ${name} RWA assets onchain. ${SPOT_METRICS}`,
				canonicalUrl: `/rwa/category/${slug}`
			}
		case 'assetGroup':
			return {
				title: `${name} RWA${DASHBOARD}`,
				description: `Track ${name} RWA assets onchain. ${SPOT_METRICS}`,
				canonicalUrl: `/rwa/asset-group/${slug}`
			}
		case 'platform':
			return {
				title: `${name} RWA${DASHBOARD}`,
				description:
					indexDescription ??
					`Explore ${name}, an RWA platform enabling issuance, custody, trading, or management of tokenized real-world assets across blockchains.`,
				canonicalUrl: `/rwa/platform/${slug}`
			}
		case 'perpsOverview':
			return {
				title: `RWA Perps${DASHBOARD}`,
				description:
					'Track RWA perpetual markets across venues. Compare open interest, 24h volume, market counts, and venue-level breakdowns.',
				canonicalUrl: '/rwa/perps'
			}
		case 'perpsAssetGroup':
			return {
				title: `${name} RWA Perps${DASHBOARD}`,
				description: `Track ${name} RWA perpetual markets. Compare open interest, 24h volume, and venue-level activity.`,
				canonicalUrl: `/rwa/perps/asset-group/${slug}`
			}
		case 'perpsAsset':
			return {
				title: `${name} Perpetual Markets${SUFFIX}`,
				description: `Compare ${name} perpetual markets across venues by open interest, volume, funding, and market activity.`,
				canonicalUrl: `/rwa/perps/asset/${slug}`
			}
		case 'venue':
			return {
				title: `${name} RWA Perps${DASHBOARD}`,
				description: `Track ${name} RWA perpetual markets by open interest, volume, market activity, and instrument-level breakdowns.`,
				canonicalUrl: `/rwa/perps/venue/${slug}`
			}
	}
}

/** The h1 of an overview or scope page: its headline metric. Null on an entity page, whose h1 is its name. */
export function getRwaPageHeadline(kind: RWAPageKind, scopeName: string | null): string | null {
	switch (kind) {
		case 'overview':
			return definitions.totalActiveMcap.label
		case 'chain':
		case 'category':
		case 'assetGroup':
			return `${scopeName} RWA Active AUM`
		case 'perpsOverview':
			return 'Total RWA Perps Open Interest'
		case 'perpsAssetGroup':
		case 'perpsAsset':
			return `${scopeName} Perps Open Interest`
		case 'platform':
		case 'venue':
			return null
	}
}
