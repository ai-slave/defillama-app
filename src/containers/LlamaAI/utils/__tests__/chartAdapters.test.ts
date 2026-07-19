import { describe, expect, it } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { adaptCandlestickData } from '~/containers/LlamaAI/utils/chartAdapters/candlestick'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import { adaptHBarChartData } from '~/containers/LlamaAI/utils/chartAdapters/hbar'
import { adaptPieChartData } from '~/containers/LlamaAI/utils/chartAdapters/pie'
import { adaptScatterChartData } from '~/containers/LlamaAI/utils/chartAdapters/scatter'

const baseConfig: ChartConfiguration = {
	id: 'chart-1',
	type: 'scatter',
	title: 'Chart',
	description: 'Chart description',
	axes: {
		x: { field: 'x', label: 'X', type: 'value' },
		yAxes: [{ id: 'left', fields: ['y'], label: 'Y', position: 'left' }]
	},
	series: [
		{
			name: 'Series',
			type: 'scatter',
			yAxisId: 'left',
			metricClass: 'stock',
			dataMapping: { xField: 'x', yField: 'y', entityFilter: { field: 'protocol', value: 'all' } },
			styling: {}
		}
	],
	dataTransformation: { timeField: 'x', metrics: ['y'] },
	displayOptions: {
		canStack: false,
		canShowPercentage: false,
		canShowCumulative: false,
		supportsGrouping: false
	}
}

describe('chart adapters', () => {
	it('forwards configured y-axis positions to the renderer', () => {
		const config = {
			...baseConfig,
			type: 'line',
			axes: {
				x: { field: 'date', label: 'Date', type: 'time' as const },
				yAxes: [{ id: 'right', fields: ['value'], label: 'Value', position: 'right' as const }]
			},
			series: [
				{
					...baseConfig.series[0]!,
					type: 'line' as const,
					yAxisId: 'right',
					dataMapping: { xField: 'date', yField: 'value' }
				}
			]
		} satisfies ChartConfiguration

		const result = adaptCartesianChartData(config, [{ date: 1_767_225_600, value: 10 }])

		expect(result.props.chartOptions.yAxis[0].position).toBe('right')
	})

	it('rejects cartesian series names that collide with dimensions or another series', () => {
		const timestampCollision = {
			...baseConfig,
			type: 'line',
			axes: { x: { field: 'date', label: 'Date', type: 'time' as const }, yAxes: baseConfig.axes.yAxes },
			series: [
				{
					...baseConfig.series[0]!,
					name: 'timestamp',
					type: 'line' as const,
					dataMapping: { xField: 'date', yField: 'y' }
				}
			]
		} satisfies ChartConfiguration
		const duplicateNames = {
			...timestampCollision,
			series: [
				{ ...timestampCollision.series[0], name: 'Duplicate' },
				{ ...timestampCollision.series[0], name: 'Duplicate' }
			]
		} satisfies ChartConfiguration

		expect(adaptCartesianChartData(timestampCollision, [{ date: 1, y: 2 }]).description).toContain('reserved')
		expect(adaptCartesianChartData(duplicateNames, [{ date: 1, y: 2 }]).description).toContain('Duplicate')
	})

	it('preserves falsy category labels in cartesian, pie, hbar, and scatter adapters', () => {
		const categoryConfig = {
			...baseConfig,
			type: 'bar',
			axes: { ...baseConfig.axes, x: { field: 'x', label: 'X', type: 'category' as const } },
			series: [
				{
					...baseConfig.series[0]!,
					type: 'bar' as const,
					dataMapping: { xField: 'x', yField: 'y' }
				}
			]
		} satisfies ChartConfiguration

		expect(adaptCartesianChartData(categoryConfig, [{ x: 0, y: 1 }]).props.dataset.source[0]).toMatchObject({
			category: '0'
		})
		expect(adaptPieChartData({ ...baseConfig, type: 'pie' }, [{ x: 0, y: 1 }]).props.chartData).toEqual([
			{ name: '0', value: 1 }
		])
		expect(
			adaptHBarChartData({ ...baseConfig, type: 'hbar', series: [{ ...baseConfig.series[0]!, type: 'hbar' }] }, [
				{ x: 0, y: 1 }
			]).data
		).toEqual([['0', 1]])
		expect(adaptScatterChartData(baseConfig, [{ x: 1, y: 2, protocol: 0 }]).props.chartData).toEqual([[1, 2, '0', '0']])
	})

	it('keeps legacy blank category labels as Unknown while preserving numeric zero', () => {
		const categoryConfig = {
			...baseConfig,
			type: 'bar',
			axes: { ...baseConfig.axes, x: { field: 'x', label: 'X', type: 'category' as const } },
			series: [
				{
					...baseConfig.series[0]!,
					type: 'bar' as const,
					dataMapping: { xField: 'x', yField: 'y' }
				}
			]
		} satisfies ChartConfiguration

		const result = adaptCartesianChartData(categoryConfig, [
			{ x: '', y: 1 },
			{ x: 0, y: 2 }
		])

		expect(result.props.dataset.source).toEqual([
			{ category: 'Unknown', Series: 1 },
			{ category: '0', Series: 2 }
		])
	})

	it('matches an entityFilter with a string value against numeric row values', () => {
		const numericSeriesConfig = {
			...baseConfig,
			type: 'bar',
			axes: {
				x: { field: 'exchange', label: 'exchange', type: 'category' as const },
				yAxes: [{ id: 'y1', fields: ['round_trip_slippage_bps'], label: 'bps', position: 'left' as const }]
			},
			series: [
				{
					name: '$10K Trade',
					type: 'bar' as const,
					yAxisId: 'y1',
					metricClass: 'stock' as const,
					dataMapping: {
						xField: 'exchange',
						yField: 'round_trip_slippage_bps',
						entityFilter: { field: 'trade_size_usd', value: '10000' }
					},
					styling: {}
				},
				{
					name: '$50K Trade',
					type: 'bar' as const,
					yAxisId: 'y1',
					metricClass: 'stock' as const,
					dataMapping: {
						xField: 'exchange',
						yField: 'round_trip_slippage_bps',
						entityFilter: { field: 'trade_size_usd', value: '50000' }
					},
					styling: {}
				}
			],
			dataTransformation: { timeField: '', metrics: ['round_trip_slippage_bps'] }
		} satisfies ChartConfiguration

		const result = adaptCartesianChartData(numericSeriesConfig, [
			{ exchange: 'binance', trade_size_usd: 10000, round_trip_slippage_bps: 20.1 },
			{ exchange: 'binance', trade_size_usd: 50000, round_trip_slippage_bps: 40.2 },
			{ exchange: 'gate', trade_size_usd: 10000, round_trip_slippage_bps: 21.5 },
			{ exchange: 'gate', trade_size_usd: 50000, round_trip_slippage_bps: 42.0 }
		])

		expect(result.props.dataset.source).toEqual([
			{ category: 'binance', '$10K Trade': 20.1, '$50K Trade': 40.2 },
			{ category: 'gate', '$10K Trade': 21.5, '$50K Trade': 42.0 }
		])
	})

	it('honors explicit per-slice colors on a pie via config.seriesColors', () => {
		const pieConfig = {
			...baseConfig,
			type: 'pie',
			seriesColors: { Uniswap: '#ff007a', Curve: '#0000ff' },
			series: [{ ...baseConfig.series[0]!, dataMapping: { xField: 'protocol', yField: 'v' } }]
		} satisfies ChartConfiguration
		const result = adaptPieChartData(pieConfig, [
			{ protocol: 'Uniswap', v: 100 },
			{ protocol: 'Curve', v: 60 },
			{ protocol: 'Balancer', v: 30 }
		])
		expect(result.props.stackColors!.Uniswap).toBe('#ff007a')
		expect(result.props.stackColors!.Curve).toBe('#0000ff')
		// unspecified slice falls back to the palette (any non-empty color)
		expect(result.props.stackColors!.Balancer).toMatch(/^#|rgb/)
		expect(result.props.stackColors!.Balancer).not.toBe('#ff007a')
	})

	it('preserves Object prototype names in cartesian and pie datasets', () => {
		const cartesianConfig = {
			...baseConfig,
			type: 'bar',
			axes: { ...baseConfig.axes, x: { field: 'x', label: 'X', type: 'category' as const } },
			series: [
				{
					...baseConfig.series[0]!,
					name: '__proto__',
					type: 'bar' as const,
					dataMapping: { xField: 'x', yField: 'y' }
				}
			]
		} satisfies ChartConfiguration
		const cartesian = adaptCartesianChartData(cartesianConfig, [{ x: 'A', y: 7 }])

		expect(Object.getPrototypeOf(cartesian.props.dataset.source[0])).toBe(Object.prototype)
		expect(cartesian.props.dataset.source[0]?.__proto__).toBe(7)

		const pieConfig = {
			...baseConfig,
			type: 'pie',
			series: [{ ...baseConfig.series[0]!, dataMapping: { xField: 'entity', yField: 'value' } }]
		} satisfies ChartConfiguration
		const pie = adaptPieChartData(pieConfig, [
			{ entity: 'constructor', value: 2 },
			{ entity: '__proto__', value: 3 }
		])

		expect(pie.props.chartData).toEqual([
			{ name: '__proto__', value: 3 },
			{ name: 'constructor', value: 2 }
		])
		expect(Object.getPrototypeOf(pie.props.stackColors)).toBeNull()
	})

	it('rotates a crowded category x-axis so long labels do not drop, and reserves grid bottom', () => {
		const cfg = {
			...baseConfig,
			type: 'bar',
			axes: {
				x: { field: 'venue', label: 'venue', type: 'category' as const },
				yAxes: [{ id: 'y1', fields: ['v'], label: 'v', position: 'left' as const }]
			},
			series: [
				{
					name: 'V',
					type: 'bar' as const,
					yAxisId: 'y1',
					metricClass: 'stock' as const,
					dataMapping: { xField: 'venue', yField: 'v' },
					styling: {}
				}
			],
			dataTransformation: { timeField: '', metrics: ['v'] }
		} satisfies ChartConfiguration
		const rows = [
			'Bitvavo (MiCA)',
			'Bybit.eu (MiCA)',
			'Gate (MiCA)',
			'Backpack (MiCA)',
			'Bitget (Global)',
			'KuCoin (Global)',
			'Binance (Global)',
			'MEXC (Global)'
		].map((venue, i) => ({ venue, v: 20 + i }))

		const out = adaptCartesianChartData(cfg, rows)
		expect(out.props.chartOptions.xAxis.axisLabel).toMatchObject({ interval: 0, rotate: 35 })
		expect(out.props.chartOptions.grid.bottom).toBeGreaterThan(44)
	})

	it('leaves a small, short-label category axis flat', () => {
		const cfg = {
			...baseConfig,
			type: 'bar',
			axes: {
				x: { field: 'venue', label: 'venue', type: 'category' as const },
				yAxes: [{ id: 'y1', fields: ['v'], label: 'v', position: 'left' as const }]
			},
			series: [
				{
					name: 'V',
					type: 'bar' as const,
					yAxisId: 'y1',
					metricClass: 'stock' as const,
					dataMapping: { xField: 'venue', yField: 'v' },
					styling: {}
				}
			],
			dataTransformation: { timeField: '', metrics: ['v'] }
		} satisfies ChartConfiguration
		const out = adaptCartesianChartData(cfg, [
			{ venue: 'ETH', v: 1 },
			{ venue: 'BTC', v: 2 },
			{ venue: 'SOL', v: 3 }
		])
		expect(out.props.chartOptions.xAxis.axisLabel).toBeUndefined()
	})

	it('builds grouped series for a multi-series hbar (two bars per category)', () => {
		const groupedHBar = {
			...baseConfig,
			type: 'hbar',
			axes: {
				x: { field: 'venue', label: 'venue', type: 'category' as const },
				yAxes: [{ id: 'y1', fields: ['btc', 'eth'], label: 'bps', position: 'left' as const }]
			},
			series: [
				{
					name: 'BTC',
					type: 'hbar' as const,
					yAxisId: 'y1',
					metricClass: 'stock' as const,
					dataMapping: { xField: 'venue', yField: 'btc' },
					styling: { color: '#2f7ef6' }
				},
				{
					name: 'ETH',
					type: 'hbar' as const,
					yAxisId: 'y1',
					metricClass: 'stock' as const,
					dataMapping: { xField: 'venue', yField: 'eth' },
					styling: { color: '#e11d48' }
				}
			],
			dataTransformation: { timeField: '', metrics: ['btc', 'eth'] }
		} satisfies ChartConfiguration

		const result = adaptHBarChartData(groupedHBar, [
			{ venue: 'Bitvavo', btc: 67, eth: 71 },
			{ venue: 'Gate', btc: 22, eth: 21 },
			{ venue: 'MEXC', btc: 15, eth: 20 }
		])

		// categories preserved in order via the fallback `data` array
		expect(result.data.map(([c]) => c)).toEqual(['Bitvavo', 'Gate', 'MEXC'])
		// two grouped series, each aligned to the categories, honoring the per-series color
		expect(result.props.series).toEqual([
			{ name: 'BTC', values: [67, 22, 15], color: '#2f7ef6' },
			{ name: 'ETH', values: [71, 21, 20], color: '#e11d48' }
		])
	})

	it('honors per-category seriesColors on a single-series hbar (editor recolor)', () => {
		const hbar = {
			...baseConfig,
			type: 'hbar',
			seriesColors: { binance: '#ff007a' },
			series: [{ ...baseConfig.series[0]!, type: 'hbar' as const, styling: {} }]
		} satisfies ChartConfiguration
		const result = adaptHBarChartData(hbar, [
			{ x: 'binance', y: 20 },
			{ x: 'gate', y: 21 }
		])
		expect(result.props.colors![0]).toBe('#ff007a') // binance overridden
		expect(result.props.colors![1]).not.toBe('#ff007a') // gate keeps the palette
	})

	it('gives hbar bars distinct colors regardless of the series styling.color the tool stamps', () => {
		// the backend stamps styling.color = palette[0] on every series, including single-series hbar;
		// hbar must ignore it and keep per-bar distinct colors (a ranking chart, not one flat color).
		const hbar = {
			...baseConfig,
			type: 'hbar',
			series: [{ ...baseConfig.series[0]!, type: 'hbar' as const, styling: { color: '#2563eb' } }]
		} satisfies ChartConfiguration

		const result = adaptHBarChartData(hbar, [
			{ x: 'binance', y: 20.1 },
			{ x: 'gate', y: 21.5 }
		])
		expect(result.props.colors).toHaveLength(2)
		expect(new Set(result.props.colors).size).toBe(2)
	})

	it('filters scatter rows with missing or non-numeric coordinates', () => {
		const result = adaptScatterChartData(baseConfig, [
			{ x: 1, y: 2, protocol: 'valid' },
			{ x: null, y: 3, protocol: 'null-x' },
			{ x: 'bad', y: 4, protocol: 'bad-x' },
			{ x: 5, y: undefined, protocol: 'missing-y' },
			{ x: '6.5', y: '7.5', protocol: 'string-coords' }
		])

		expect(result.props.chartData).toEqual([
			[1, 2, 'valid', 'valid'],
			[6.5, 7.5, 'string-coords', 'string-coords']
		])
	})

	it('escapes scatter tooltip entity names', () => {
		const result = adaptScatterChartData(baseConfig, [{ x: 1, y: 2, protocol: '<img src=x onerror=alert(1)>' }])
		const tooltip = result.props.tooltipFormatter?.({ value: [1, 2, '<img src=x onerror=alert(1)>'] })

		expect(tooltip).toContain('&lt;img src=x onerror=alert(1)&gt;')
		expect(tooltip).not.toContain('<img src=x')
	})

	it('keeps cartesian time-series rows sorted after adaptation', () => {
		const timeConfig = {
			...baseConfig,
			type: 'line',
			axes: { ...baseConfig.axes, x: { field: 'timestamp', label: 'Date', type: 'time' as const } },
			series: [
				{
					...baseConfig.series[0]!,
					type: 'line' as const,
					dataMapping: { xField: 'timestamp', yField: 'y' }
				}
			],
			dataTransformation: { timeField: 'timestamp', metrics: ['y'] }
		} satisfies ChartConfiguration

		const result = adaptCartesianChartData(timeConfig, [
			{ timestamp: Date.UTC(2026, 2, 1), y: 3 },
			{ timestamp: Date.UTC(2026, 0, 1), y: 1 },
			{ timestamp: Date.UTC(2026, 1, 1), y: 2 }
		])

		expect(result.props.dataset.source.map((row) => row.timestamp)).toEqual([
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 1, 1),
			Date.UTC(2026, 2, 1)
		])
	})

	it('filters candlestick rows with invalid timestamps before building indicators', () => {
		const timestamp = Date.UTC(2026, 0, 1)
		const config = {
			...baseConfig,
			type: 'candlestick',
			axes: { ...baseConfig.axes, x: { field: 'timestamp', label: 'Date', type: 'time' as const } },
			series: [
				{
					...baseConfig.series[0]!,
					type: 'candlestick' as const,
					dataMapping: { xField: 'timestamp', yField: 'close' }
				}
			],
			dataTransformation: { timeField: 'timestamp', metrics: ['open', 'high', 'low', 'close'] }
		} satisfies ChartConfiguration

		const result = adaptCandlestickData(config, [
			{
				timestamp: 'bad',
				open: 1,
				high: 3,
				low: 0,
				close: 2,
				volume: 10,
				sma_7: 4,
				rsi: 60
			},
			{
				timestamp,
				open: 2,
				high: 5,
				low: 1,
				close: 4,
				volume: 20,
				sma_7: 3,
				rsi: 55
			}
		])

		expect(result.data).toHaveLength(1)
		expect(result.data[0]?.[0]).toBe(timestamp)
		expect(result.indicators?.every((indicator) => indicator.data?.length === 1)).toBe(true)
	})
})
