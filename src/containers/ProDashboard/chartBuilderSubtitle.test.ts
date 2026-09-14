import { expect, test } from 'vitest'
import { chartBuilderSubtitleParts } from './chartBuilderSubtitle'
import type { ChartBuilderConfig } from './types'

const baseConfig: ChartBuilderConfig['config'] = {
	metric: 'fees',
	mode: 'chains',
	chainFilterMode: 'include',
	categoryFilterMode: 'include',
	chainCategoryFilterMode: 'include',
	protocolCategoryFilterMode: 'include',
	chains: [],
	categories: [],
	groupBy: 'protocol',
	limit: 10,
	chartType: 'line',
	displayAs: 'timeSeries'
}

test('a chains builder names the chain scope, the limit and the time period', () => {
	expect(
		chartBuilderSubtitleParts({
			config: baseConfig,
			protocolName: null,
			hasExactRemainder: true,
			treemapMode: 'latest',
			timePeriod: '30d'
		})
	).toEqual(['All chains • Top 10 protocols', '30D'])
})

test('excluded chains and categories are spelled out', () => {
	expect(
		chartBuilderSubtitleParts({
			config: {
				...baseConfig,
				chains: ['Ethereum', 'Base'],
				chainFilterMode: 'exclude',
				categories: ['Dexs'],
				categoryFilterMode: 'exclude',
				hideOthers: true
			},
			protocolName: null,
			hasExactRemainder: true,
			treemapMode: 'latest',
			timePeriod: 'all'
		})
	).toEqual(['Excluding Ethereum, Base • Top 10 protocols only', 'Excluding Dexs'])
})

test('a protocol builder leads with the protocol and falls back to All Protocols', () => {
	const protocolConfig: ChartBuilderConfig['config'] = { ...baseConfig, mode: 'protocol', protocol: 'aave' }
	expect(
		chartBuilderSubtitleParts({
			config: protocolConfig,
			protocolName: 'Aave',
			hasExactRemainder: false,
			treemapMode: 'latest',
			timePeriod: null
		})
	).toEqual(['Aave', 'Top 10 chains', 'All chains'])
	expect(
		chartBuilderSubtitleParts({
			config: { ...protocolConfig, chainCategories: ['L2'], chainCategoryFilterMode: 'exclude' },
			protocolName: null,
			hasExactRemainder: true,
			treemapMode: 'latest',
			timePeriod: null
		})
	).toEqual(['All Protocols', 'All chains', 'Excluding L2'])
})

test('a treemap reports its window instead of the time period', () => {
	expect(
		chartBuilderSubtitleParts({
			config: { ...baseConfig, chartType: 'treemap' },
			protocolName: null,
			hasExactRemainder: true,
			treemapMode: 'sum7d',
			timePeriod: '30d'
		})
	).toEqual(['All chains • Top 10 protocols', '7D'])
})
