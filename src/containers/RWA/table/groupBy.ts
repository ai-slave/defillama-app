import { normalizeRwaAssetGroup } from '../assetGroup'
import { getPrimaryRwaCategory, getRwaPlatforms, UNKNOWN_PLATFORM } from '../grouping'
import { rwaSlug } from '../rwaSlug'
import type { RWAGroupIcon, RWALeafRow } from './rows'

export type RWATableView = 'assets' | 'perps'
export const RWA_GROUP_BY_OPTIONS = ['platform', 'chain', 'assetGroup', 'category', 'asset', 'none'] as const
export type RWAGroupBy = (typeof RWA_GROUP_BY_OPTIONS)[number]
export const RWA_GROUP_BY_QUERY_KEY = 'groupBy'

/** The page a table sits on: the overview, or one chain, category, platform or asset group. */
export type RWAGroupByScope = 'all' | 'chain' | 'category' | 'platform' | 'assetGroup'
export type RWAGroupByOptions = { scope?: RWAGroupByScope }

/** Every page opens by platform. The Perps view calls it Venue. */
export function getRwaDefaultGroupBy(_view: RWATableView, _options: RWAGroupByOptions = {}): RWAGroupBy {
	return 'platform'
}

const GROUP_BY_LABELS: Record<RWAGroupBy, string> = {
	platform: 'Platform',
	chain: 'Chain',
	assetGroup: 'Asset Group',
	category: 'Category',
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
	chain: 'An asset sits under every chain it has onchain marketcap on; unpriced rows sit under no chain.'
}

export function getRwaGroupByOptions(
	view: RWATableView,
	options: RWAGroupByOptions = {}
): Array<{ key: RWAGroupBy; name: string; help?: string }> {
	return RWA_GROUP_BY_OPTIONS.filter((groupBy) => isRwaGroupByAllowed(groupBy, view, options)).map((key) => ({
		key,
		name: getRwaGroupByLabel(key, view),
		...(GROUP_BY_HELP[key] ? { help: GROUP_BY_HELP[key] } : {})
	}))
}

/** The platform option reads Venue in the Perps view. */
export function getRwaGroupByLabel(groupBy: RWAGroupBy, view: RWATableView): string {
	return view === 'perps' && groupBy === 'platform' ? 'Venue' : GROUP_BY_LABELS[groupBy]
}

export function parseRwaGroupBy(
	query: string | Array<string> | undefined,
	view: RWATableView,
	options: RWAGroupByOptions = {}
): RWAGroupBy {
	const value = Array.isArray(query) ? query[0] : query
	const groupBy = RWA_GROUP_BY_OPTIONS.find((option) => option === value)
	return groupBy && isRwaGroupByAllowed(groupBy, view, options) ? groupBy : getRwaDefaultGroupBy(view, options)
}

export function getRwaGroupByQueryValue(
	groupBy: RWAGroupBy,
	view: RWATableView,
	options: RWAGroupByOptions = {}
): string | undefined {
	return groupBy === getRwaDefaultGroupBy(view, options) ? undefined : groupBy
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
				{ key: assetGroup, label: assetGroup, href: `/rwa/asset-group/${rwaSlug(assetGroup)}`, icon: null, chain: null }
			]
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
			const category = getPrimaryRwaCategory(row.asset.category)
			return [
				category
					? { key: category, label: category, href: `/rwa/category/${rwaSlug(category)}`, icon: null, chain: null }
					: { key: UNKNOWN_GROUP, label: UNKNOWN_GROUP, href: null, icon: null, chain: null }
			]
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

/**
 * Perps markets carry no chain and share one category, so both groupings are spot-only; a spot row is its own
 * asset, so Asset is perps-only. A chain page is one chain, so it has no Chain grouping.
 */
function isRwaGroupByAllowed(groupBy: RWAGroupBy, view: RWATableView, { scope = 'all' }: RWAGroupByOptions): boolean {
	if (view === 'perps') return groupBy !== 'chain' && groupBy !== 'category'
	if (scope === 'chain' && groupBy === 'chain') return false
	return groupBy !== 'asset'
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}
