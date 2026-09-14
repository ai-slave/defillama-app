import type { ChartBuilderConfig } from './types'

export interface ChartBuilderSubtitleInput {
	config: ChartBuilderConfig['config']
	protocolName: string | null
	hasExactRemainder: boolean
	treemapMode: string
	timePeriod: string | null
}

export function chartBuilderSubtitleParts({
	config,
	protocolName,
	hasExactRemainder,
	treemapMode,
	timePeriod
}: ChartBuilderSubtitleInput): Array<string> {
	const parts: Array<string> = []
	if (config.mode === 'protocol') {
		parts.push(protocolName ?? 'All Protocols')
		if (!hasExactRemainder) parts.push(`Top ${config.limit} chains`)
		if (config.chainFilterMode === 'exclude' && config.chains.length > 0) {
			parts.push(`Excluding ${config.chains.join(', ')}`)
		} else if (config.chains.length > 0) {
			parts.push(config.chains.join(', '))
		} else {
			parts.push('All chains')
		}
		if (config.chainCategories && config.chainCategories.length > 0) {
			const categories = config.chainCategories.join(', ')
			parts.push(config.chainCategoryFilterMode === 'exclude' ? `Excluding ${categories}` : categories)
		}
		if (config.protocolCategories && config.protocolCategories.length > 0) {
			const categories = config.protocolCategories.join(', ')
			parts.push(config.protocolCategoryFilterMode === 'exclude' ? `Excluding ${categories}` : categories)
		}
	} else {
		const chainLabel = config.chains.length > 0 ? config.chains.join(', ') : 'All chains'
		const chainDisplay =
			config.chainFilterMode === 'exclude' && config.chains.length > 0 ? `Excluding ${chainLabel}` : chainLabel
		parts.push(`${chainDisplay} • Top ${config.limit} protocols${config.hideOthers ? ' only' : ''}`)
		if (config.categories.length > 0) {
			const categories = config.categories.join(', ')
			parts.push(config.categoryFilterMode === 'exclude' ? `Excluding ${categories}` : categories)
		}
	}
	if (config.chartType === 'treemap') {
		parts.push(treemapMode === 'latest' ? 'Latest' : treemapMode === 'sum7d' ? '7D' : '30D')
	} else if (timePeriod && timePeriod !== 'all') {
		parts.push(timePeriod.toUpperCase())
	}
	return parts
}
