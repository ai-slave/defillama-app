import type { NextApiRequest, NextApiResponse } from 'next'
import { ImageResponse } from 'next/og'
import type { ReactElement } from 'react'
import { buildProDashboardChartSourcePlan } from '~/containers/ProDashboard/chartSourcePlan'
import { buildSingleMetricChartDataset } from '~/containers/ProDashboard/components/singleMetricChart'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { createVariableCatalog, resolveDashboardItems } from '~/containers/ProDashboard/dashboardVariables/resolve'
import { countDashboardWidgets, isDashboardWidget } from '~/containers/ProDashboard/dashboardWidgets'
import { buildProDashboardProtocolRelations } from '~/containers/ProDashboard/protocolCatalog'
import {
	fetchAppMetadata,
	fetchDashboardConfigWithStatus,
	fetchProtocolsAndChains,
	fetchSingleChartData,
	withTimeout
} from '~/containers/ProDashboard/queries.server'
import { createBoundedTaskScheduler } from '~/containers/ProDashboard/server/stream/taskScheduler'
import type { ChartConfig } from '~/containers/ProDashboard/types'
import { summarizeDashboardItems } from '~/containers/ProDashboard/utils/seo'
import { formatDate } from '~/utils/dateFormat'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import {
	buildDashboardOgCard,
	buildStaticDashboardOgCard,
	getOgChartImageSize,
	OG_CARD_MAX_CHARTS,
	type DashboardOgCardChart
} from './card'
import { renderChartSvgDataUri } from './renderChartSvg'

const OG_IMAGE_VARIANT_SIZES = {
	og: { width: 1200, height: 630 },
	thumb: { width: 600, height: 315 }
} as const

type OgImageVariant = keyof typeof OG_IMAGE_VARIANT_SIZES
type OgImageSize = (typeof OG_IMAGE_VARIANT_SIZES)[OgImageVariant]

const OG_IMAGE_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400'
const OG_IMAGE_CACHE_MAX_ENTRIES = 200
const OG_IMAGE_CACHE_TTL_MS = 60 * 60 * 1000
const OG_IMAGE_DATA_TIMEOUT_MS = 5000
const OG_IMAGE_RENDER_CONCURRENCY = 2
const OG_IMAGE_SUMMARY_LINE_COUNT = 3
const DEFAULT_DASHBOARD_NAME = 'Untitled Dashboard'

const renderedImages = new Map<string, { buffer: Buffer; expiresAt: number }>()
const renderScheduler = createBoundedTaskScheduler(OG_IMAGE_RENDER_CONCURRENCY, () => false)
const OG_SHARED_DATA_TTL_MS = 10 * 60 * 1000

function createSharedLoader<T>(load: () => Promise<T | null>): () => Promise<T | null> {
	let cached: { promise: Promise<T | null>; expiresAt: number } | null = null
	return () => {
		const now = Date.now()
		if (cached && cached.expiresAt > now) return cached.promise
		const entry = {
			promise: load().then((value) => {
				if (value === null && cached === entry) cached = null
				return value
			}),
			expiresAt: now + OG_SHARED_DATA_TTL_MS
		}
		cached = entry
		return entry.promise
	}
}

const getSharedCatalog = createSharedLoader(() => fetchProtocolsAndChains())
const getSharedAppMetadata = createSharedLoader(() => fetchAppMetadata())

function readCachedImage(key: string): Buffer | null {
	const entry = renderedImages.get(key)
	if (!entry) return null
	renderedImages.delete(key)
	if (entry.expiresAt <= Date.now()) return null
	renderedImages.set(key, entry)
	return entry.buffer
}

function writeCachedImage(key: string, buffer: Buffer): void {
	renderedImages.set(key, {
		buffer,
		expiresAt: Date.now() + OG_IMAGE_CACHE_TTL_MS
	})
	while (renderedImages.size > OG_IMAGE_CACHE_MAX_ENTRIES) {
		const oldest = renderedImages.keys().next()
		if (oldest.done) return
		renderedImages.delete(oldest.value)
	}
}

async function renderCardToPng(element: ReactElement, size: OgImageSize): Promise<Buffer> {
	const holder: { buffer?: Buffer } = {}
	await renderScheduler.schedule(async () => {
		const response = new ImageResponse(element, {
			width: size.width,
			height: size.height
		})
		holder.buffer = Buffer.from(await response.arrayBuffer())
	})
	if (!holder.buffer) throw new Error('dashboard og image render produced no output')
	return holder.buffer
}

interface DashboardOgChartCandidate {
	caption: string
	chart: ChartConfig
}

function collectChartCandidates(
	items: Array<DashboardItemConfig>,
	labelByItemId: Map<string, string>
): Array<DashboardOgChartCandidate> {
	const candidates: Array<DashboardOgChartCandidate> = []
	for (const item of items) {
		if (candidates.length >= OG_CARD_MAX_CHARTS) break
		if (!isDashboardWidget(item)) continue
		const chart = item.kind === 'chart' ? item : item.kind === 'multi' ? item.items[0] : undefined
		if (!chart) continue
		candidates.push({ caption: labelByItemId.get(item.id) ?? '', chart })
	}
	return candidates
}

function hasChartCandidates(items: Array<DashboardItemConfig>): boolean {
	return items.some((item) => item.kind === 'chart' || item.kind === 'multi')
}

async function buildChartTiles(dashboard: Dashboard, size: OgImageSize): Promise<Array<DashboardOgCardChart>> {
	if (!hasChartCandidates(dashboard.data?.items ?? [])) return []
	const [catalog, appMetadata] = await Promise.all([getSharedCatalog(), getSharedAppMetadata()])
	const { items } = resolveDashboardItems(
		dashboard.data?.items ?? [],
		dashboard.data?.variables ?? [],
		{},
		createVariableCatalog(catalog)
	)
	const labelByItemId = new Map(summarizeDashboardItems(items).map((summary) => [summary.id, summary.label]))
	const candidates = collectChartCandidates(items, labelByItemId)
	if (candidates.length === 0) return []

	const relations = buildProDashboardProtocolRelations(catalog)
	const timePeriod = dashboard.data?.timePeriod ?? '365d'
	const customTimePeriod = dashboard.data?.customTimePeriod ?? null
	const imageSize = getOgChartImageSize(size.width)

	const tiles = await Promise.all(
		candidates.map(async (candidate): Promise<DashboardOgCardChart | null> => {
			const [plan] = buildProDashboardChartSourcePlan([candidate.chart], catalog, appMetadata)
			if (!plan || plan.skipReason) return null
			const data = await fetchSingleChartData(plan.request, timePeriod, customTimePeriod, relations).catch(() => null)
			if (data === null) return null
			const dataset = buildSingleMetricChartDataset(data, candidate.caption, false)
			const imageDataUri = renderChartSvgDataUri(dataset, imageSize.width, imageSize.height)
			if (imageDataUri === null) return null
			return { id: candidate.chart.id, caption: candidate.caption, imageDataUri }
		})
	)

	return tiles.filter((tile): tile is DashboardOgCardChart => tile !== null)
}

function formatUpdatedLabel(dashboard: Dashboard): string {
	return formatDate(dashboard.editedAt || dashboard.updated) ?? ''
}

function buildMetaLine(dashboard: Dashboard): string {
	const cardCount = countDashboardWidgets(dashboard.data?.items ?? [])
	const cards = `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`
	const updated = formatUpdatedLabel(dashboard)
	return updated ? `${cards} · updated ${updated}` : cards
}

async function buildPublicCard(
	dashboard: Dashboard,
	size: OgImageSize
): Promise<{ element: ReactElement; cacheable: boolean }> {
	const charts = await withTimeout(buildChartTiles(dashboard, size), OG_IMAGE_DATA_TIMEOUT_MS).catch((): null => null)
	const element = buildDashboardOgCard({
		width: size.width,
		height: size.height,
		title: dashboard.data?.dashboardName || DEFAULT_DASHBOARD_NAME,
		authorName: dashboard.author?.displayName || null,
		metaLine: buildMetaLine(dashboard),
		charts: charts ?? [],
		summaryLines: summarizeDashboardItems(dashboard.data?.items ?? [])
			.slice(0, OG_IMAGE_SUMMARY_LINE_COUNT)
			.map((summary) => summary.label)
			.filter(Boolean)
	})
	return { element, cacheable: charts !== null }
}

function readVariant(query: NextApiRequest['query']): OgImageVariant {
	return query.variant === 'thumb' ? 'thumb' : 'og'
}

export async function dashboardOgImageHandler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
	const dashboardId = typeof req.query.dashboardId === 'string' ? req.query.dashboardId : ''
	const variant = readVariant(req.query)
	const size = OG_IMAGE_VARIANT_SIZES[variant]

	const { dashboard } = await fetchDashboardConfigWithStatus(dashboardId, null).catch(() => ({
		dashboard: null as Dashboard | null
	}))
	const publicDashboard = dashboard?.visibility === 'public' ? dashboard : null
	const version = publicDashboard ? publicDashboard.editedAt || publicDashboard.updated || '' : 'static'
	const cacheKey = `${dashboardId}:${variant}:${version}`

	const cached = readCachedImage(cacheKey)
	if (cached) {
		sendPngImage(res, cached)
		return
	}

	let element: ReactElement
	let cacheable = true
	try {
		if (publicDashboard) {
			const card = await buildPublicCard(publicDashboard, size)
			element = card.element
			cacheable = card.cacheable
		} else {
			element = buildStaticDashboardOgCard(size)
		}
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		element = buildStaticDashboardOgCard(size)
		cacheable = false
	}

	try {
		const buffer = await renderCardToPng(element, size)
		if (cacheable) writeCachedImage(cacheKey, buffer)
		sendPngImage(res, buffer)
	} catch (error) {
		recordRouteRuntimeError(error, 'apiRoute')
		res.status(500).end()
	}
}

function sendPngImage(res: NextApiResponse, buffer: Buffer): void {
	res.setHeader('Content-Type', 'image/png')
	res.setHeader('Cache-Control', OG_IMAGE_CACHE_CONTROL)
	res.status(200).send(buffer)
}
