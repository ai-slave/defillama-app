import { describe, expect, test } from 'vitest'
import { buildStablecoinChartSeriesUrl, buildStablecoinVolumeChartUrl } from '../queries.client'

describe('buildStablecoinChartSeriesUrl', () => {
	test('encodes overview filters and skips undefined values', () => {
		const url = buildStablecoinChartSeriesUrl({
			scope: 'overview',
			chain: 'All',
			chart: 'tokenMcaps',
			seriesLimit: 10,
			filters: {
				attribute: ['STABLE', 'YIELDBEARING'],
				excludePegtype: 'PEGGEDEUR',
				backing: undefined,
				minMcap: '100'
			},
			enabled: false
		})

		expect(url).toBe(
			'/api/public/stablecoins/chart-series?scope=overview&chart=tokenMcaps&limit=10&chain=All&attribute=STABLE&attribute=YIELDBEARING&excludePegtype=PEGGEDEUR&minMcap=100'
		)
	})

	test('encodes unreleased asset chart requests', () => {
		expect(
			buildStablecoinChartSeriesUrl({
				scope: 'asset',
				stablecoin: 'tether',
				chart: 'totalCirc',
				includeUnreleased: true
			})
		).toBe('/api/public/stablecoins/chart-series?scope=asset&chart=totalCirc&stablecoin=tether&unreleased=true')
	})

	test('encodes an explicit bounded runtime selection', () => {
		expect(
			buildStablecoinChartSeriesUrl({
				scope: 'overview',
				chain: 'All',
				chart: 'dominance',
				seriesLimit: 10,
				selectionIntent: { mode: 'include', names: ['USDT', 'DAI'] }
			})
		).toBe(
			'/api/public/stablecoins/chart-series?scope=overview&chart=dominance&limit=10&include=true&series=USDT&series=DAI&chain=All'
		)
	})

	test('encodes an exclusion without serializing the full selected universe', () => {
		expect(
			buildStablecoinChartSeriesUrl({
				scope: 'chains',
				chart: 'chainMcaps',
				selectionIntent: { mode: 'exclude', names: ['Ethereum'] }
			})
		).toBe('/api/public/stablecoins/chart-series?scope=chains&chart=chainMcaps&exclude=true&series=Ethereum')
	})
})

describe('buildStablecoinVolumeChartUrl', () => {
	test('encodes global volume requests', () => {
		expect(buildStablecoinVolumeChartUrl({ scope: 'global', chart: 'chain', limit: 10 })).toBe(
			'/api/public/stablecoins/volume-chart?scope=global&chart=chain&limit=10'
		)
	})

	test('requests every volume series only for a complete export', () => {
		expect(buildStablecoinVolumeChartUrl({ scope: 'global', chart: 'token', allSeries: true })).toBe(
			'/api/public/stablecoins/volume-chart?scope=global&chart=token&all=true'
		)
	})

	test('encodes compact volume exclusions', () => {
		expect(
			buildStablecoinVolumeChartUrl({
				scope: 'global',
				chart: 'token',
				selectionIntent: { mode: 'exclude', names: ['USDT'] }
			})
		).toBe('/api/public/stablecoins/volume-chart?scope=global&chart=token&limit=20&exclude=true&series=USDT')
	})

	test('encodes chain scoped volume requests without dimension filters', () => {
		expect(buildStablecoinVolumeChartUrl({ scope: 'chain', chain: 'Ethereum', chart: 'token' })).toBe(
			'/api/public/stablecoins/volume-chart?scope=chain&chart=token&limit=20&chain=Ethereum'
		)
	})

	test('encodes token scoped volume requests without fallback filters', () => {
		expect(buildStablecoinVolumeChartUrl({ scope: 'token', token: 'USDT', chart: 'chain' })).toBe(
			'/api/public/stablecoins/volume-chart?scope=token&chart=chain&limit=20&token=USDT'
		)
	})
})
