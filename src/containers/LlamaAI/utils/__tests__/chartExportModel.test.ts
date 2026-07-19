import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { adaptHBarChartData } from '~/containers/LlamaAI/utils/chartAdapters/hbar'
import { buildExportModel } from '~/containers/LlamaAI/utils/chartExportModel'

describe('chartExportModel', () => {
	it('exports every grouped horizontal-bar series as its own CSV column', () => {
		const config = {
			id: 'market-rates',
			type: 'hbar',
			title: 'Market Rates',
			description: '',
			axes: {
				x: { field: 'venue', label: 'Venue', type: 'category' },
				yAxes: [{ id: 'rates', fields: ['btc', 'eth'], label: 'Rate', position: 'left' }]
			},
			series: [
				{
					name: 'BTC',
					type: 'hbar',
					yAxisId: 'rates',
					metricClass: 'stock',
					dataMapping: { xField: 'venue', yField: 'btc' },
					styling: { color: '#2f7ef6' }
				},
				{
					name: 'ETH',
					type: 'hbar',
					yAxisId: 'rates',
					metricClass: 'stock',
					dataMapping: { xField: 'venue', yField: 'eth' },
					styling: { color: '#e11d48' }
				}
			],
			dataTransformation: { timeField: '', metrics: ['btc', 'eth'] },
			displayOptions: {
				canStack: false,
				canShowPercentage: false,
				canShowCumulative: false,
				supportsGrouping: false
			}
		} satisfies ChartConfiguration
		const adaptedChart = adaptHBarChartData(config, [
			{ venue: 'Bitvavo', btc: 67, eth: 71 },
			{ venue: 'Gate', btc: 22, eth: 21 }
		])

		expect(buildExportModel(config, adaptedChart)?.csvRows).toEqual([
			['Category', 'BTC', 'ETH'],
			['Bitvavo', 67, 71],
			['Gate', 22, 21]
		])
	})
})
