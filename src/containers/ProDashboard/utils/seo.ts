import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import { slug } from '~/utils'
import { sluggifyProtocol } from '~/utils/cache-client'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard } from '../dashboardTypes'

const SITE_URL = 'https://defillama.com'
const DEFAULT_DASHBOARD_NAME = 'Untitled Dashboard'
const DEFAULT_DESCRIPTION = 'Community-built DefiLlama Pro dashboard.'
const MAX_DESCRIPTION_LENGTH = 155
const MAX_SUMMARY_ITEMS = 24

type DashboardJsonLdValue = string | number | boolean | null | DashboardJsonLdValue[] | DashboardJsonLdObject
type DashboardJsonLdObject = { [key: string]: DashboardJsonLdValue }

export interface DashboardItemSummary {
	id: string
	label: string
	href?: string
}

export interface DashboardSeo {
	title: string
	description: string
	canonicalPath: string
	updated: string | null
	tags: string[]
	itemCount: number
	itemSummaries: DashboardItemSummary[]
	jsonLd: DashboardJsonLdObject
}

export interface DashboardSeoPublicDashboard {
	id: string
	slug?: string
	data: {
		dashboardName: string
	}
	visibility: 'public'
	tags: string[]
	description: string
	viewCount?: number
	likeCount?: number
	author?: PublicDashboardAuthor
	created: string
	updated: string
	editedAt?: string
}

export function toDashboardSeoPublicDashboard(dashboard: Dashboard): DashboardSeoPublicDashboard {
	return {
		id: dashboard.id,
		...(dashboard.slug === undefined ? {} : { slug: dashboard.slug }),
		data: {
			dashboardName: dashboard.data?.dashboardName || DEFAULT_DASHBOARD_NAME
		},
		visibility: 'public',
		tags: Array.isArray(dashboard.tags) ? dashboard.tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [],
		description: typeof dashboard.description === 'string' ? dashboard.description : '',
		...(dashboard.viewCount === undefined ? {} : { viewCount: dashboard.viewCount }),
		...(dashboard.likeCount === undefined ? {} : { likeCount: dashboard.likeCount }),
		...(dashboard.author === undefined ? {} : { author: dashboard.author }),
		created: dashboard.created,
		updated: dashboard.updated,
		...(dashboard.editedAt === undefined ? {} : { editedAt: dashboard.editedAt })
	}
}

function safeSameAs(author: PublicDashboardAuthor | undefined): string[] {
	if (!author?.socials) return []
	return Object.values(author.socials).filter((value): value is string => {
		if (typeof value !== 'string') return false
		try {
			const url = new URL(value)
			return url.protocol === 'https:' && !url.username && !url.password
		} catch {
			return false
		}
	})
}

function compactWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

export function markdownToPlainText(value: unknown): string {
	if (typeof value !== 'string') return ''

	return compactWhitespace(
		value
			.replace(/<[^>]*>/g, ' ')
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
			.replace(/(^|\s)#{1,6}\s+/g, ' ')
			.replace(/[*_~>#-]+/g, ' ')
	)
}

function truncateText(value: string, maxLength: number): string {
	const text = compactWhitespace(value)
	if (text.length <= maxLength) return text
	const sliced = text.slice(0, maxLength - 1)
	const lastSpace = sliced.lastIndexOf(' ')
	return `${sliced.slice(0, lastSpace > 80 ? lastSpace : sliced.length).trim()}...`
}

function titleCaseToken(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return ''
	return value
		.replace(/[-_]/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.split(' ')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

function getDashboardName(dashboard: Dashboard): string {
	return compactWhitespace(dashboard.data?.dashboardName || DEFAULT_DASHBOARD_NAME)
}

function getDashboardUpdated(dashboard: Dashboard): string | null {
	return dashboard.editedAt || dashboard.updated || dashboard.created || null
}

function protocolHref(protocol: unknown): string | undefined {
	if (typeof protocol !== 'string' || !protocol.trim()) return undefined
	return `/protocol/${sluggifyProtocol(protocol)}`
}

function chainHref(chain: unknown): string | undefined {
	if (typeof chain !== 'string' || !chain.trim() || chain === 'All') return undefined
	return `/chain/${slug(chain)}`
}

function subjectLabel(item: DashboardItemConfig): { label: string; href?: string } {
	if (item.kind === 'metric') {
		if (item.subject.itemType === 'protocol') {
			const href = protocolHref(item.subject.protocol)
			return { label: titleCaseToken(item.subject.protocol), ...(href === undefined ? {} : { href }) }
		}
		const href = chainHref(item.subject.chain)
		return { label: item.subject.chain, ...(href === undefined ? {} : { href }) }
	}
	if (item.kind === 'chart') {
		if (item.subjectType === 'protocol') {
			const href = protocolHref(item.protocol)
			return { label: titleCaseToken(item.protocol), ...(href === undefined ? {} : { href }) }
		}
		const href = chainHref(item.chain)
		return { label: item.chain, ...(href === undefined ? {} : { href }) }
	}
	if ('protocolName' in item && item.protocolName) {
		const href = protocolHref(item.protocol)
		return { label: item.protocolName, ...(href === undefined ? {} : { href }) }
	}
	if ('protocol' in item && item.protocol) {
		const href = protocolHref(item.protocol)
		return { label: titleCaseToken(item.protocol), ...(href === undefined ? {} : { href }) }
	}
	if ('chain' in item && item.chain) {
		const href = chainHref(item.chain)
		return { label: item.chain, ...(href === undefined ? {} : { href }) }
	}
	return { label: 'DefiLlama' }
}

function createDashboardItemSummary(id: string, label: string, href?: string): DashboardItemSummary {
	// `getServerSideProps` must return JSON-serializable values. Omit optional links
	// instead of emitting `href: undefined`, which makes the whole dashboard return 500.
	return { id, label, ...(href ? { href } : {}) }
}

function unifiedTableSummaryLabel(item: Extract<DashboardItemConfig, { kind: 'unified-table' }>): string {
	const presetName = item.activePresetId?.replace(/-protocols$/, '')
	const tableName = presetName && presetName !== 'custom' ? titleCaseToken(presetName) : null
	const chains = item.params?.chains
	const chainScope = chains?.length ? ` for ${chains.slice(0, 3).join(', ')}` : ''
	const headerName = item.rowHeaders.map(titleCaseToken).join(', ') || 'Protocol'
	return `${tableName ?? headerName} table${chainScope}`
}

function summarizeSingleItem(item: DashboardItemConfig, index: number): DashboardItemSummary {
	const subject = subjectLabel(item)
	const fallbackId = `${item.kind}-${index}`
	const id = 'id' in item && typeof item.id === 'string' ? item.id : fallbackId

	switch (item.kind) {
		case 'chart':
			return createDashboardItemSummary(id, `${subject.label} ${titleCaseToken(item.type)} chart`, subject.href)
		case 'multi':
			return {
				id,
				label: item.name || `${item.items.length} chart comparison`
			}
		case 'dataset-table': {
			const dataset = titleCaseToken(item.datasetType)
			const chains = 'chains' in item && item.chains.length ? ` for ${item.chains.slice(0, 3).join(', ')}` : ''
			return { id, label: `${dataset} table${chains}` }
		}
		case 'unified-table':
			return { id, label: unifiedTableSummaryLabel(item) }
		case 'text': {
			const text = markdownToPlainText(item.title || item.content)
			return { id, label: text ? `Text note: ${truncateText(text, 90)}` : 'Text note' }
		}
		case 'metric': {
			const label = item.label || `${subject.label} ${titleCaseToken(item.type)} metric`
			return createDashboardItemSummary(id, label, subject.href)
		}
		case 'builder':
			return { id, label: item.name || `${titleCaseToken(item.config.metric)} ${item.config.mode} chart builder` }
		case 'yields':
			return { id, label: `${item.project} ${item.poolName} ${titleCaseToken(item.chartType || 'yield')} chart` }
		case 'stablecoins':
			return createDashboardItemSummary(
				id,
				`${item.chain} ${titleCaseToken(item.chartType)} stablecoins chart`,
				chainHref(item.chain)
			)
		case 'stablecoin-asset':
			return { id, label: `${item.stablecoin} ${titleCaseToken(item.chartType)} chart` }
		case 'advanced-tvl':
			return createDashboardItemSummary(
				id,
				`${item.protocolName} ${titleCaseToken(item.chartType)} chart`,
				protocolHref(item.protocol)
			)
		case 'advanced-borrowed':
			return createDashboardItemSummary(
				id,
				`${item.protocolName} ${titleCaseToken(item.chartType)} borrowed chart`,
				protocolHref(item.protocol)
			)
		case 'income-statement':
			return createDashboardItemSummary(id, `${item.protocolName} income statement`, protocolHref(item.protocol))
		case 'unlocks-schedule':
			return createDashboardItemSummary(id, `${item.protocolName} unlocks schedule`, protocolHref(item.protocol))
		case 'unlocks-pie':
			return createDashboardItemSummary(
				id,
				`${item.protocolName} ${titleCaseToken(item.chartType)} unlocks chart`,
				protocolHref(item.protocol)
			)
		case 'llamaai-chart':
			return { id, label: item.title || 'LlamaAI chart' }
		case 'rwa-overview':
			return { id, label: `${titleCaseToken(item.metric)} by ${titleCaseToken(item.breakdown)} RWA ${item.chartView}` }
		case 'rwa-asset':
			return { id, label: `${item.assetName} RWA asset chart` }
		case 'sql':
			return { id, label: item.name || 'SQL chart' }
	}
}

export function summarizeDashboardItems(items: DashboardItemConfig[] | undefined): DashboardItemSummary[] {
	if (!Array.isArray(items)) return []
	return items.slice(0, MAX_SUMMARY_ITEMS).map(summarizeSingleItem)
}

function buildFallbackDescription(
	dashboardName: string,
	itemSummaries: DashboardItemSummary[],
	itemCount: number
): string {
	if (itemCount === 0) return DEFAULT_DESCRIPTION

	const subjects = itemSummaries
		.map((item) => item.label)
		.filter(Boolean)
		.slice(0, 3)
		.join(', ')

	return truncateText(
		`${dashboardName} is a community-built DefiLlama Pro dashboard with ${itemCount} items${subjects ? ` covering ${subjects}` : ''}.`,
		MAX_DESCRIPTION_LENGTH
	)
}

export function buildDashboardSeo(dashboard: Dashboard): DashboardSeo {
	const name = getDashboardName(dashboard)
	const itemCount = Array.isArray(dashboard.data?.items) ? dashboard.data.items.length : 0
	const itemSummaries = summarizeDashboardItems(dashboard.data?.items)
	const explicitDescription = truncateText(markdownToPlainText(dashboard.description), MAX_DESCRIPTION_LENGTH)
	const description = explicitDescription || buildFallbackDescription(name, itemSummaries, itemCount)
	const canonicalPath = `/pro/${dashboard.slug || dashboard.id}`
	const updated = getDashboardUpdated(dashboard)
	const tags = Array.isArray(dashboard.tags)
		? dashboard.tags.filter((tag) => typeof tag === 'string' && tag.trim())
		: []
	const url = `${SITE_URL}${canonicalPath}`
	const author = dashboard.author
	const authorUrl = author ? `${SITE_URL}/authors/${author.slug}` : null
	const authorSameAs = safeSameAs(author)
	const authorNode =
		author && authorUrl
			? {
					'@type': 'Person',
					'@id': `${authorUrl}#person`,
					name: author.displayName,
					url: authorUrl,
					...(author.bio ? { description: author.bio } : {}),
					...(author.avatarUrl ? { image: author.avatarUrl } : {}),
					...(authorSameAs.length ? { sameAs: authorSameAs } : {})
				}
			: null
	const webPage = {
		'@type': 'WebPage',
		'@id': `${url}#webpage`,
		url,
		name,
		description,
		...(dashboard.created ? { datePublished: dashboard.created } : {}),
		...(updated ? { dateModified: updated } : {}),
		...(tags.length ? { keywords: tags.join(', ') } : {}),
		...(authorNode ? { author: { '@id': authorNode['@id'] } } : {}),
		isPartOf: {
			'@type': 'WebSite',
			name: 'DefiLlama',
			url: SITE_URL
		}
	}

	const graph: DashboardJsonLdObject[] = [
		webPage,
		{
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'DefiLlama', item: SITE_URL },
				{ '@type': 'ListItem', position: 2, name: 'Pro Dashboards', item: `${SITE_URL}/pro` },
				{ '@type': 'ListItem', position: 3, name, item: url }
			]
		}
	]
	if (authorNode) graph.push(authorNode)

	return {
		title: `${name} - DefiLlama Pro Dashboard`,
		description,
		canonicalPath,
		updated,
		tags,
		itemCount,
		itemSummaries,
		jsonLd: {
			'@context': 'https://schema.org',
			'@graph': graph
		}
	}
}
