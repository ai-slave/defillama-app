import type {
	ArticleChartAnnotation,
	ArticleChartConfig,
	ArticleChartEntity,
	ArticleChartEntityType,
	ArticleChartRange,
	ArticleChartSeries
} from './types'

const VALID_RANGES: ReadonlySet<ArticleChartRange> = new Set(['30d', '90d', '365d', 'all'])

const MAX_SERIES = 4
const MAX_ANNOTATIONS = 5

function validateEntityType(value: unknown): ArticleChartEntityType | null {
	return value === 'protocol' || value === 'chain' ? value : null
}

function validateEntity(value: unknown): ArticleChartEntity | null {
	if (!value || typeof value !== 'object') return null
	const candidate = value as Partial<ArticleChartEntity> & Record<string, unknown>
	const entityType = validateEntityType(candidate.entityType)
	if (!entityType) return null
	if (typeof candidate.slug !== 'string' || candidate.slug.trim().length === 0) return null
	const slug = candidate.slug.trim()
	const name = typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : slug
	return {
		entityType,
		slug,
		name,
		...(typeof candidate.geckoId === 'string' && candidate.geckoId.trim() ? { geckoId: candidate.geckoId.trim() } : {})
	}
}

function validateSeries(value: unknown, fallbackChartType?: string): ArticleChartSeries | null {
	if (!value || typeof value !== 'object') return null
	const candidate = value as Partial<ArticleChartSeries> & Record<string, unknown>
	const entityType = validateEntityType(candidate.entityType)
	if (!entityType) return null
	if (typeof candidate.slug !== 'string' || candidate.slug.trim().length === 0) return null
	const slug = candidate.slug.trim()
	const name = typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : slug
	const seriesChartType =
		typeof candidate.chartType === 'string' && candidate.chartType.trim().length > 0
			? candidate.chartType.trim()
			: fallbackChartType
	if (!seriesChartType) return null
	return {
		entityType,
		slug,
		name,
		...(typeof candidate.geckoId === 'string' && candidate.geckoId.trim() ? { geckoId: candidate.geckoId.trim() } : {}),
		chartType: seriesChartType
	}
}

function validateAnnotation(value: unknown): ArticleChartAnnotation | null {
	if (!value || typeof value !== 'object') return null
	const candidate = value as Partial<ArticleChartAnnotation>
	if (typeof candidate.date !== 'string' || !candidate.date.trim()) return null
	const ts = Date.parse(candidate.date)
	if (Number.isNaN(ts)) return null
	const label = typeof candidate.label === 'string' && candidate.label.trim().length > 0 ? candidate.label.trim() : ''
	if (!label) return null
	return { date: new Date(ts).toISOString(), label: label.slice(0, 80) }
}

export function deriveLegacyEntities(series: Array<ArticleChartSeries>): Array<ArticleChartEntity> {
	const seen = new Set<string>()
	const out: Array<ArticleChartEntity> = []
	for (const s of series) {
		const key = `${s.entityType}:${s.slug}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push({
			entityType: s.entityType,
			slug: s.slug,
			name: s.name,
			...(s.geckoId ? { geckoId: s.geckoId } : {})
		})
	}
	return out
}

export function deriveLegacyChartType(series: Array<ArticleChartSeries>): string {
	const counts = new Map<string, number>()
	for (const s of series) counts.set(s.chartType, (counts.get(s.chartType) ?? 0) + 1)
	let best = series[0].chartType
	let bestCount = 0
	for (const [type, count] of counts) {
		if (count > bestCount) {
			best = type
			bestCount = count
		}
	}
	return best
}

function dedupeSeries(series: Array<ArticleChartSeries>): Array<ArticleChartSeries> {
	const seen = new Set<string>()
	const unique: Array<ArticleChartSeries> = []
	for (const item of series) {
		// This is the same identity enforced by the editor; persisted JSON still needs a runtime guard.
		const key = `${item.entityType}:${item.slug}:${item.chartType}`
		if (seen.has(key)) continue
		seen.add(key)
		unique.push(item)
	}
	return unique
}

export function validateArticleChartConfig(value: unknown): ArticleChartConfig | null {
	if (!value || typeof value !== 'object') return null
	const candidate = value as Partial<ArticleChartConfig> & Record<string, unknown>

	const legacyChartType =
		typeof candidate.chartType === 'string' && candidate.chartType.trim().length > 0
			? candidate.chartType.trim()
			: undefined

	let series: Array<ArticleChartSeries> = []
	if (Array.isArray(candidate.series)) {
		series = candidate.series
			.map((entry) => validateSeries(entry, legacyChartType))
			.filter((entry): entry is ArticleChartSeries => entry !== null)
	}

	if (series.length === 0) {
		if (!legacyChartType || !Array.isArray(candidate.entities)) return null
		series = candidate.entities
			.map(validateEntity)
			.filter((entity): entity is ArticleChartEntity => entity !== null)
			.map((entity) => ({
				entityType: entity.entityType,
				slug: entity.slug,
				name: entity.name,
				...(entity.geckoId ? { geckoId: entity.geckoId } : {}),
				chartType: legacyChartType
			}))
	}

	series = dedupeSeries(series).slice(0, MAX_SERIES)
	if (series.length === 0) return null

	const range =
		typeof candidate.range === 'string' && VALID_RANGES.has(candidate.range as ArticleChartRange)
			? (candidate.range as ArticleChartRange)
			: undefined

	const annotations = Array.isArray(candidate.annotations)
		? candidate.annotations
				.map(validateAnnotation)
				.filter((a): a is ArticleChartAnnotation => a !== null)
				.slice(0, MAX_ANNOTATIONS)
		: []

	const entities = deriveLegacyEntities(series)
	const chartType = deriveLegacyChartType(series)

	return {
		series,
		entities,
		chartType,
		...(range ? { range } : {}),
		...(candidate.logScale === true ? { logScale: true } : {}),
		...(annotations.length > 0 ? { annotations } : {}),
		...(typeof candidate.caption === 'string' && candidate.caption.trim() ? { caption: candidate.caption.trim() } : {})
	}
}
