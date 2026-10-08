import { normalizeRwaAssetGroup } from '../assetGroup'
import { getPrimaryRwaCategory, getRwaPlatforms, UNKNOWN_PLATFORM } from '../grouping'
import { getRwaPageLayout, type RWAPageKind } from '../layout/pageLayout'
import { rwaSlug } from '../rwaSlug'
import { getRwaAssetGroupHref } from './classificationHrefs'
import type { RWAGroupIcon, RWALeafRow } from './rows'

export const RWA_GROUP_BY_OPTIONS = [
	'platform',
	'chain',
	'assetGroup',
	'category',
	'assetClass',
	'asset',
	'none'
] as const
export type RWAGroupBy = (typeof RWA_GROUP_BY_OPTIONS)[number]
export const RWA_GROUP_BY_QUERY_KEY = 'groupBy'

/**
 * The Group by each page offers, in strip order. A page never offers its own dimension, nor one with a single value
 * on it: perps markets carry no chain and share one category, a spot row is its own asset, and a perps asset has one
 * asset class and one asset group.
 */
const GROUP_BY_PER_PAGE: Record<RWAPageKind, ReadonlyArray<RWAGroupBy>> = {
	overview: ['platform', 'chain', 'assetGroup', 'category', 'none'],
	chain: ['platform', 'assetGroup', 'category', 'none'],
	category: ['platform', 'chain', 'assetGroup', 'none'],
	assetGroup: ['platform', 'chain', 'category', 'none'],
	platform: ['none', 'chain', 'assetGroup', 'category'],
	perpsOverview: ['platform', 'assetGroup', 'assetClass', 'asset', 'none'],
	perpsAssetGroup: ['platform', 'assetClass', 'asset', 'none'],
	venue: ['none', 'assetGroup', 'assetClass'],
	perpsAsset: ['none', 'platform']
}

/** The page layout names the default: by platform (Venue on perps rows), None on the entity and perps asset pages. */
export function getRwaDefaultGroupBy(pageKind: RWAPageKind): RWAGroupBy {
	return getRwaPageLayout(pageKind).defaultGroupBy
}

const GROUP_BY_LABELS: Record<RWAGroupBy, string> = {
	platform: 'Platform',
	chain: 'Chain',
	assetGroup: 'Asset Group',
	category: 'Category',
	assetClass: 'Asset Class',
	asset: 'Asset',
	none: 'None'
}

const UNKNOWN_GROUP = 'Unknown'

export type RWAGroupMembership = {
	key: string
	label: string
	href: string | null
	icon: RWAGroupIcon
	chain: string | null
}

/** Platform slug to logo URL. */
export type RWAPlatformLogos = Record<string, string>

export type RWAGroupOptions = { platformLogos?: RWAPlatformLogos }

const GROUP_BY_HELP: Partial<Record<RWAGroupBy, string>> = {
	chain: 'An asset sits under every chain it has onchain AUM on; unpriced rows sit under no chain.',
	category: 'An asset sits under every category it carries, so the groups can add up to more than the total.'
}

export function getRwaGroupByOptions(pageKind: RWAPageKind): Array<{ key: RWAGroupBy; name: string; help?: string }> {
	return GROUP_BY_PER_PAGE[pageKind].map((key) => ({
		key,
		name: getRwaGroupByLabel(key, pageKind),
		...(GROUP_BY_HELP[key] ? { help: GROUP_BY_HELP[key] } : {})
	}))
}

/** The platform option reads Venue on perps rows. */
export function getRwaGroupByLabel(groupBy: RWAGroupBy, pageKind: RWAPageKind): string {
	return getRwaPageLayout(pageKind).section === 'perps' && groupBy === 'platform' ? 'Venue' : GROUP_BY_LABELS[groupBy]
}

/** A value the page does not offer, its own dimension included, falls back to the page's default. */
export function parseRwaGroupBy(query: string | Array<string> | undefined, pageKind: RWAPageKind): RWAGroupBy {
	const value = Array.isArray(query) ? query[0] : query
	return GROUP_BY_PER_PAGE[pageKind].find((option) => option === value) ?? getRwaDefaultGroupBy(pageKind)
}

export function getRwaGroupByQueryValue(groupBy: RWAGroupBy, pageKind: RWAPageKind): string | undefined {
	return groupBy === getRwaDefaultGroupBy(pageKind) ? undefined : groupBy
}

export function getRwaGroupMemberships(
	row: RWALeafRow,
	groupBy: RWAGroupBy,
	options: RWAGroupOptions = {}
): Array<RWAGroupMembership> {
	switch (groupBy) {
		case 'none':
			return []
		case 'platform':
			return [platformMembership(row, options.platformLogos)]
		case 'chain':
			return row.metrics.chains.map(({ chain }) => ({
				key: chain,
				label: chain,
				href: `/rwa/chain/${rwaSlug(chain)}`,
				icon: { kind: 'chain', name: chain },
				chain
			}))
		case 'assetGroup': {
			const assetGroup = normalizeRwaAssetGroup(row.asset.assetGroup)
			return [
				{
					key: assetGroup,
					label: assetGroup,
					// A perps group links into the Perps tree, a spot group into the Assets tree.
					href: getRwaAssetGroupHref(assetGroup, row.asset.kind === 'perps' ? 'perps' : 'spot'),
					icon: null,
					chain: null
				}
			]
		}
		case 'assetClass': {
			const assetClass = getPrimaryRwaCategory(row.asset.assetClass) ?? UNKNOWN_GROUP
			return [{ key: assetClass, label: assetClass, href: null, icon: null, chain: null }]
		}
		case 'asset': {
			const asset = (row.asset.assetName || row.asset.ticker || UNKNOWN_GROUP).trim() || UNKNOWN_GROUP
			return [
				{
					key: asset,
					label: asset,
					href: row.asset.kind === 'perps' && asset !== UNKNOWN_GROUP ? `/rwa/perps/asset/${rwaSlug(asset)}` : null,
					icon: null,
					chain: null
				}
			]
		}
		case 'category': {
			// Every category the asset carries, as the category page counts it; the group rows may then overlap.
			const categories = [...new Set((row.asset.category ?? []).map((category) => category.trim()).filter(Boolean))]
			if (categories.length === 0)
				return [{ key: UNKNOWN_GROUP, label: UNKNOWN_GROUP, href: null, icon: null, chain: null }]
			return categories.map((category) => ({
				key: category,
				label: category,
				href: `/rwa/category/${rwaSlug(category)}`,
				icon: null,
				chain: null
			}))
		}
		default:
			return assertNever(groupBy)
	}
}

function platformMembership(row: RWALeafRow, platformLogos: RWAPlatformLogos | undefined): RWAGroupMembership {
	const [platform] = getRwaPlatforms(row.asset.parentPlatform)
	if (platform === UNKNOWN_PLATFORM) return { key: platform, label: platform, href: null, icon: null, chain: null }
	const slug = rwaSlug(platform)
	const base = row.asset.kind === 'perps' ? '/rwa/perps/venue' : '/rwa/platform'
	const logo = platformLogos?.[slug]
	return {
		key: platform,
		label: platform,
		href: `${base}/${slug}`,
		icon: logo ? { kind: 'src', src: logo } : null,
		chain: null
	}
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}
