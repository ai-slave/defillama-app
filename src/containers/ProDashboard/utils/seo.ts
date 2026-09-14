import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import { slug } from '~/utils'
import { sluggifyProtocol } from '~/utils/cache-client'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Dashboard, DashboardVariable } from '../dashboardTypes'
import { countDashboardWidgets, isDashboardWidget } from '../dashboardWidgets'

const SITE_URL = 'https://defillama.com'
const DEFAULT_DASHBOARD_NAME = 'Untitled Dashboard'
const DEFAULT_DESCRIPTION = 'Community-built DefiLlama Pro dashboard.'
const MAX_DESCRIPTION_LENGTH = 155
const MAX_SUMMARY_ITEMS = 24

type DashboardJsonLdValue = string | number | boolean | null | Array<DashboardJsonLdValue> | DashboardJsonLdObject
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
	tags: Array<string>
	itemCount: number
	itemSummaries: Array<DashboardItemSummary>
	jsonLd: DashboardJsonLdObject
}

export interface DashboardSeoPublicDashboard {
	id: string
	slug?: string
	data: {
		dashboardName: string
	}
	visibility: 'public'
	tags: Array<string>
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

function safeSameAs(author: PublicDashboardAuthor | undefined): Array<string> {
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

export function truncateText(value: string, maxLength: number): string {
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

function datasetTableScope(item: Extract<DashboardItemConfig, { kind: 'dataset-table' }>): string {
	if ('ticker' in item && item.ticker) return ` for ${item.ticker}`
	if ('tokenSymbols' in item && item.tokenSymbols.length > 0)
		return ` for ${item.tokenSymbols
			.slice(0, 4)
			.map((symbol) => symbol.toUpperCase())
			.join(', ')}`
	if ('chain' in item && item.chain) return ` for ${item.chain}`
	if ('chains' in item && item.chains.length > 0) return ` for ${item.chains.slice(0, 3).join(', ')}`
	if ('category' in item && item.category) return ` for ${item.category}`
	if ('cexAnalyticsView' in item) return `: ${titleCaseToken(item.cexAnalyticsView)}`
	return ''
}

export function dashboardItemLabel(item: DashboardItemConfig): string {
	switch (item.kind) {
		case 'chart':
			return `${subjectLabel(item).label} ${titleCaseToken(item.type)} chart`
		case 'multi':
			return item.name || `${item.items.length} chart comparison`
		case 'dataset-table':
			return `${titleCaseToken(item.datasetType)} table${datasetTableScope(item)}`
		case 'unified-table':
			return unifiedTableSummaryLabel(item)
		case 'text': {
			const text = markdownToPlainText(item.title || item.content)
			return text ? `Text note: ${truncateText(text, 90)}` : 'Text note'
		}
		case 'metric':
			return item.label || `${subjectLabel(item).label} ${titleCaseToken(item.type)} metric`
		case 'builder':
			return item.name || `${titleCaseToken(item.config.metric)} ${item.config.mode} chart builder`
		case 'yields':
			return `${item.project} ${item.poolName} ${titleCaseToken(item.chartType || 'yield')} chart`
		case 'stablecoins':
			return `${item.chain} ${titleCaseToken(item.chartType)} stablecoins chart`
		case 'stablecoin-asset':
			return `${item.stablecoin} ${titleCaseToken(item.chartType)} chart`
		case 'advanced-tvl':
			return `${item.protocolName} ${titleCaseToken(item.chartType)} chart`
		case 'advanced-borrowed':
			return `${item.protocolName} ${titleCaseToken(item.chartType)} borrowed chart`
		case 'income-statement':
			return `${item.protocolName} income statement`
		case 'unlocks-schedule':
			return `${item.protocolName} unlocks schedule`
		case 'unlocks-pie':
			return `${item.protocolName} ${titleCaseToken(item.chartType)} unlocks chart`
		case 'llamaai-chart':
			return item.title || 'LlamaAI chart'
		case 'rwa-overview':
			return `${titleCaseToken(item.metric)} by ${titleCaseToken(item.breakdown)} RWA ${item.chartView}`
		case 'rwa-asset':
			return `${item.assetName} RWA asset chart`
		case 'sql':
			return item.name || 'SQL chart'
		case 'section':
			return `Section: ${item.title}`
		case 'custom-data':
			return item.name || 'Custom data'
	}
}

function dashboardItemHref(item: DashboardItemConfig): string | undefined {
	switch (item.kind) {
		case 'chart':
		case 'metric':
			return subjectLabel(item).href
		case 'stablecoins':
			return chainHref(item.chain)
		case 'advanced-tvl':
		case 'advanced-borrowed':
		case 'income-statement':
		case 'unlocks-schedule':
		case 'unlocks-pie':
			return protocolHref(item.protocol)
		default:
			return undefined
	}
}

function summarizeSingleItem(item: DashboardItemConfig, index: number): DashboardItemSummary {
	const fallbackId = `${item.kind}-${index}`
	const id = 'id' in item && typeof item.id === 'string' ? item.id : fallbackId
	return createDashboardItemSummary(id, dashboardItemLabel(item), dashboardItemHref(item))
}

export function summarizeDashboardItems(items: Array<DashboardItemConfig> | undefined): Array<DashboardItemSummary> {
	if (!Array.isArray(items)) return []
	return items.filter(isDashboardWidget).slice(0, MAX_SUMMARY_ITEMS).map(summarizeSingleItem)
}

export function summarizeDashboardSections(items: Array<DashboardItemConfig> | undefined): Array<string> {
	if (!Array.isArray(items)) return []
	const titles: Array<string> = []
	for (const item of items) {
		if (item.kind === 'section' && item.title.trim()) titles.push(compactWhitespace(item.title))
	}
	return titles
}

export function summarizeDashboardVariables(variables: Array<DashboardVariable> | undefined): string {
	if (!Array.isArray(variables) || variables.length === 0) return ''
	return variables.map((variable) => `${variable.label} = ${variable.value}`).join(', ')
}

function buildFallbackDescription(
	dashboardName: string,
	itemSummaries: Array<DashboardItemSummary>,
	itemCount: number,
	sectionTitles: Array<string>,
	parameters: string
): string {
	if (itemCount === 0) return DEFAULT_DESCRIPTION

	const subjects = itemSummaries
		.map((item) => item.label)
		.filter(Boolean)
		.slice(0, 3)
		.join(', ')
	const sections = sectionTitles.slice(0, 4).join(', ')

	return truncateText(
		`${dashboardName} is a community-built DefiLlama Pro dashboard with ${itemCount} cards${subjects ? ` covering ${subjects}` : ''}${sections ? ` across ${sections}` : ''}.${parameters ? ` Parameters: ${parameters}.` : ''}`,
		MAX_DESCRIPTION_LENGTH
	)
}

export function buildDashboardSeo(dashboard: Dashboard): DashboardSeo {
	const name = getDashboardName(dashboard)
	const itemCount = Array.isArray(dashboard.data?.items) ? countDashboardWidgets(dashboard.data.items) : 0
	const itemSummaries = summarizeDashboardItems(dashboard.data?.items)
	const sectionTitles = summarizeDashboardSections(dashboard.data?.items)
	const parameters = summarizeDashboardVariables(dashboard.data?.variables)
	const explicitDescription = truncateText(markdownToPlainText(dashboard.description), MAX_DESCRIPTION_LENGTH)
	const description =
		explicitDescription || buildFallbackDescription(name, itemSummaries, itemCount, sectionTitles, parameters)
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
					...(authorSameAs.length > 0 ? { sameAs: authorSameAs } : {})
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
		...(tags.length > 0 ? { keywords: tags.join(', ') } : {}),
		...(authorNode ? { author: { '@id': authorNode['@id'] } } : {}),
		isPartOf: {
			'@type': 'WebSite',
			name: 'DefiLlama',
			url: SITE_URL
		}
	}

	const graph: Array<DashboardJsonLdObject> = [
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
