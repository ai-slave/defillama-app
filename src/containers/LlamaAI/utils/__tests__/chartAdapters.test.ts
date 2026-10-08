import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { adaptCandlestickData } from '~/containers/LlamaAI/utils/chartAdapters/candlestick'
import { adaptCartesianChartData } from '~/containers/LlamaAI/utils/chartAdapters/cartesian'
import { adaptHBarChartData } from '~/containers/LlamaAI/utils/chartAdapters/hbar'
import { adaptPieChartData } from '~/containers/LlamaAI/utils/chartAdapters/pie'
import { adaptScatterChartData } from '~/containers/LlamaAI/utils/chartAdapters/scatter'

const baseSeries: ChartConfiguration['series'][number] = {
	name: 'Series',
	type: 'scatter',
	yAxisId: 'left',
	metricClass: 'stock',
	dataMapping: { xField: 'x', yField: 'y', entityFilter: { field: 'protocol', value: 'all' } },
	styling: {}
}

const baseConfig: ChartConfiguration = {
	id: 'chart-1',
	type: 'scatter',
	title: 'Chart',
	description: 'Chart description',
	axes: {
		x: { field: 'x', label: 'X', type: 'value' },
		yAxes: [{ id: 'left', fields: ['y'], label: 'Y', position: 'left' }]
	},
	series: [baseSeries],
	dataTransformation: { timeField: 'x', metrics: ['y'] },
	displayOptions: {
		canStack: false,
		canShowPercentage: false,
		canShowCumulative: false,
		supportsGrouping: false
	}
}

describe('chart adapters', () => {
	test('forwards configured y-axis positions to the renderer', () => {
		const config = {
			...baseConfig,
			type: 'line',
			axes: {
				x: { field: 'date', label: 'Date', type: 'time' as const },
				yAxes: [{ id: 'right', fields: ['value'], label: 'Value', position: 'right' as const }]
			},
			series: [
				{
					...baseSeries,
					type: 'line' as const,
					yAxisId: 'right',
					dataMapping: { xField: 'date', yField: 'value' }
				}
			]
		} satisfies ChartConfiguration

		const result = adaptCartesianChartData(config, [{ date: 1_767_225_600, value: 10 }])

		const yAxis = Array.isArray(result.props.chartOptions?.yAxis)
			? result.props.chartOptions.yAxis[0]
			: result.props.chartOptions?.yAxis
		expect(yAxis?.position).toBe('right')
	})

	const timestampSeries = {
		...baseConfig,
		type: 'line',
		axes: { x: { field: 'date', label: 'Date', type: 'time' as const }, yAxes: baseConfig.axes.yAxes },
		series: [{ ...baseSeries, name: 'timestamp', type: 'line' as const, dataMapping: { xField: 'date', yField: 'y' } }]
	} satisfies ChartConfiguration

	test('a series named like the x dimension still plots its own column', () => {
		const result = adaptCartesianChartData(timestampSeries, [{ date: 1, y: 2 }])
		expect(result.props.dataset.dimensions).toEqual(['timestamp', 'timestamp'])
		expect(result.props.charts?.[0]?.encode).toEqual({ x: 0, y: 1 })
	})

	test('two series with the same name fail with an error that names it', () => {
		vi.spyOn(console, 'log').mockImplementation(() => undefined)
		const series = timestampSeries.series[0]
		const duplicateNames = {
			...timestampSeries,
			series: [
				{ ...series, name: 'Duplicate' },
				{ ...series, name: 'Duplicate' }
			]
		} satisfies ChartConfiguration

		expect(adaptCartesianChartData(duplicateNames, [{ date: 1, y: 2 }]).description).toBe(
			'Failed to render chart: Duplicate series name "Duplicate" is not allowed'
		)
	})

	test('preserves falsy category labels in cartesian, pie, hbar, and scatter adapters', () => {
		const categoryConfig = {
			...baseConfig,
			type: 'bar',
			axes: { ...baseConfig.axes, x: { field: 'x', label: 'X', type: 'category' as const } },
			series: [
				{
					...baseSeries,
					type: 'bar' as const,
					dataMapping: { xField: 'x', yField: 'y' }
				}
			]
		} satisfies ChartConfiguration

		expect(adaptCartesianChartData(categoryConfig, [{ x: 0, y: 1 }]).props.dataset.source[0]).toEqual(['0', 1])
		expect(adaptPieChartData({ ...baseConfig, type: 'pie' }, [{ x: 0, y: 1 }]).props.chartData).toEqual([
			{ name: '0', value: 1 }
		])
		expect(
			adaptHBarChartData({ ...baseConfig, type: 'hbar', series: [{ ...baseSeries, type: 'hbar' }] }, [{ x: 0, y: 1 }])
				.data
		).toEqual([['0', 1]])
		expect(adaptScatterChartData(baseConfig, [{ x: 1, y: 2, protocol: 0 }]).props.chartData).toEqual([[1, 2, '0', '0']])
	})

	test('keeps legacy blank category labels as Unknown while preserving numeric zero', () => {
		const categoryConfig = {
			...baseConfig,
			type: 'bar',
			axes: { ...baseConfig.axes, x: { field: 'x', label: 'X', type: 'category' as const } },
			series: [
				{
					...baseSeries,
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
			['Unknown', 1],
			['0', 2]
		])
	})

	test('matches an entityFilter with a string value against numeric row values', () => {
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
			{ exchange: 'binance', trade_size_usd: 10_000, round_trip_slippage_bps: 20.1 },
			{ exchange: 'binance', trade_size_usd: 50_000, round_trip_slippage_bps: 40.2 },
			{ exchange: 'gate', trade_size_usd: 10_000, round_trip_slippage_bps: 21.5 },
			{ exchange: 'gate', trade_size_usd: 50_000, round_trip_slippage_bps: 42.0 }
		])

		expect(result.props.dataset.source).toEqual([
			['binance', 20.1, 40.2],
			['gate', 21.5, 42.0]
		])
	})

	test('honors explicit per-slice colors on a pie via config.seriesColors', () => {
		const pieConfig = {
			...baseConfig,
			type: 'pie',
			seriesColors: { Uniswap: '#ff007a', Curve: '#0000ff' },
			series: [{ ...baseSeries, dataMapping: { xField: 'protocol', yField: 'v' } }]
		} satisfies ChartConfiguration
		const result = adaptPieChartData(pieConfig, [
			{ protocol: 'Uniswap', v: 100 },
			{ protocol: 'Curve', v: 60 },
			{ protocol: 'Balancer', v: 30 }
		])
		expect(result.props.stackColors).toMatchObject({ Uniswap: '#ff007a', Curve: '#0000ff' })
		// unspecified slice falls back to the palette (any non-empty color)
		expect(result.props.stackColors?.Balancer).toMatch(/^#|rgb/)
		expect(result.props.stackColors?.Balancer).not.toBe('#ff007a')
	})

	test('rotates a crowded category x-axis so long labels do not drop, and reserves grid bottom', () => {
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
		const xAxis = Array.isArray(out.props.chartOptions?.xAxis)
			? out.props.chartOptions.xAxis[0]
			: out.props.chartOptions?.xAxis
		const grid = Array.isArray(out.props.chartOptions?.grid)
			? out.props.chartOptions.grid[0]
			: out.props.chartOptions?.grid
		expect(xAxis?.axisLabel).toMatchObject({ interval: 0, rotate: 35 })
		expect(grid?.bottom).toBeGreaterThan(44)
	})

	test('leaves a small, short-label category axis flat', () => {
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
		const xAxis = Array.isArray(out.props.chartOptions?.xAxis)
			? out.props.chartOptions.xAxis[0]
			: out.props.chartOptions?.xAxis
		expect(xAxis?.axisLabel).toBeUndefined()
	})

	test('uses category logos only when every rendered category has one', () => {
		const categorySeries: ChartConfiguration['series'][number] = {
			...baseSeries,
			type: 'bar',
			dataMapping: { xField: 'chain', yField: 'value' }
		}
		const categoryConfig = {
			...baseConfig,
			type: 'bar',
			axes: {
				x: {
					field: 'chain',
					label: 'Chain',
					type: 'category' as const,
					entityType: 'chain' as const,
					logoKeys: { Ethereum: 'ethereum' }
				},
				yAxes: [{ id: 'value', fields: ['value'], label: 'TVL', position: 'left' as const }]
			},
			series: [categorySeries]
		} satisfies ChartConfiguration
		const rows = [
			{ chain: 'Ethereum', value: 10 },
			{ chain: 'Solana', value: 20 }
		]

		const partial = adaptCartesianChartData(categoryConfig, rows)
		const complete = adaptCartesianChartData(
			{
				...categoryConfig,
				axes: {
					...categoryConfig.axes,
					x: { ...categoryConfig.axes.x, logoKeys: { Ethereum: 'ethereum', Solana: 'solana' } }
				}
			},
			rows
		)
		const partialHBar = adaptHBarChartData(
			{ ...categoryConfig, type: 'hbar', series: [{ ...categorySeries, type: 'hbar' }] },
			rows
		)
		const completeHBar = adaptHBarChartData(
			{
				...categoryConfig,
				type: 'hbar',
				axes: {
					...categoryConfig.axes,
					x: { ...categoryConfig.axes.x, logoKeys: { Ethereum: 'ethereum', Solana: 'solana' } }
				},
				series: [{ ...categorySeries, type: 'hbar' }]
			},
			rows
		)

		expect(partial.props.categoryLogos).toBeUndefined()
		expect(complete.props.categoryLogos).toHaveLength(2)
		expect(complete.props.categoryLogos?.every(Boolean)).toBe(true)
		expect(partialHBar.props.logos).toBeUndefined()
		expect(completeHBar.props.logos?.every(Boolean)).toBe(true)
	})

	test('builds grouped series for a multi-series hbar (two bars per category)', () => {
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

	test('honors per-category seriesColors on a single-series hbar (editor recolor)', () => {
		const hbar = {
			...baseConfig,
			type: 'hbar',
			seriesColors: { binance: '#ff007a' },
			series: [{ ...baseSeries, type: 'hbar', styling: {} }]
		} satisfies ChartConfiguration
		const result = adaptHBarChartData(hbar, [
			{ x: 'binance', y: 20 },
			{ x: 'gate', y: 21 }
		])
		expect(result.props.colors![0]).toBe('#ff007a') // binance overridden
		expect(result.props.colors![1]).not.toBe('#ff007a') // gate keeps the palette
	})

	test('gives hbar bars distinct colors regardless of the series styling.color the tool stamps', () => {
		// the backend stamps styling.color = palette[0] on every series, including single-series hbar;
		// hbar must ignore it and keep per-bar distinct colors (a ranking chart, not one flat color).
		const hbar = {
			...baseConfig,
			type: 'hbar',
			series: [{ ...baseSeries, type: 'hbar', styling: { color: '#2563eb' } }]
		} satisfies ChartConfiguration

		const result = adaptHBarChartData(hbar, [
			{ x: 'binance', y: 20.1 },
			{ x: 'gate', y: 21.5 }
		])
		expect(result.props.colors).toHaveLength(2)
		expect(new Set(result.props.colors).size).toBe(2)
	})

	test('filters scatter rows with missing or non-numeric coordinates', () => {
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

	test('escapes scatter tooltip entity names', () => {
		const result = adaptScatterChartData(baseConfig, [{ x: 1, y: 2, protocol: '<img src=x onerror=alert(1)>' }])
		const tooltip = result.props.tooltipFormatter?.({ value: [1, 2, '<img src=x onerror=alert(1)>'] })

		expect(tooltip).toContain('&lt;img src=x onerror=alert(1)&gt;')
		expect(tooltip).not.toContain('<img src=x')
	})

	test('escapes renamed scatter axis labels in the tooltip', () => {
		const config = {
			...baseConfig,
			axes: {
				x: { ...baseConfig.axes.x, label: '<img src=x onerror=alert(1)>' },
				yAxes: [{ ...baseConfig.axes.yAxes[0]!, label: 'Fees & <b>revenue</b>' }]
			}
		} satisfies ChartConfiguration
		const result = adaptScatterChartData(config, [{ x: 1, y: 2, protocol: 'Aave' }])

		const tooltip = result.props.tooltipFormatter?.({ value: [1, 2, 'Aave'] })

		expect(tooltip).toContain('Aave')
		expect(tooltip).toContain('&lt;img src=x onerror=alert(1)&gt;: 1')
		expect(tooltip).toContain('Fees &amp; &lt;b&gt;revenue&lt;/b&gt;: 2')
		expect(tooltip).not.toContain('<img')
		expect(tooltip).not.toContain('<b>')
	})

	test('category tooltips list each renamed series with its own value, escaped', () => {
		const config = {
			...baseConfig,
			type: 'bar',
			axes: {
				x: { field: 'chain', label: 'Chain', type: 'category' as const },
				yAxes: [{ id: 'left', fields: ['tvl', 'fees'], label: 'USD', position: 'left' as const }]
			},
			series: [
				{
					...baseSeries,
					name: 'TVL <img src=x onerror=alert(1)>',
					type: 'bar' as const,
					dataMapping: { xField: 'chain', yField: 'tvl' }
				},
				{ ...baseSeries, name: 'Fees', type: 'bar' as const, dataMapping: { xField: 'chain', yField: 'fees' } }
			]
		} satisfies ChartConfiguration
		const result = adaptCartesianChartData(config, [{ chain: '<svg onload=alert(1)>', tvl: 20, fees: 5 }])
		const formatter = result.props.chartOptions?.tooltip
		const row = result.props.dataset.source[0]
		// ECharts passes each series its dataset row and the encoded y column.
		const params = result.props.charts.map((chart) => ({
			seriesName: chart.name,
			marker: '',
			name: row?.[0],
			value: row,
			encode: { x: [0], y: [chart.encode.y] }
		}))

		const tooltip =
			formatter && !Array.isArray(formatter) && typeof formatter.formatter === 'function'
				? formatter.formatter(params as never, '')
				: null

		expect(tooltip).toContain('&lt;svg onload=alert(1)&gt;')
		expect(tooltip).toContain('TVL &lt;img src=x onerror=alert(1)&gt;: 20')
		expect(tooltip).toContain('Fees: 5')
		expect(tooltip).not.toContain('<img')
		expect(tooltip).not.toContain('<svg')
	})

	test('keeps cartesian time-series rows sorted after adaptation', () => {
		const timeConfig = {
			...baseConfig,
			type: 'line',
			axes: { ...baseConfig.axes, x: { field: 'timestamp', label: 'Date', type: 'time' as const } },
			series: [
				{
					...baseSeries,
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

		expect(result.props.dataset.source.map((row) => row[0])).toEqual([
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 1, 1),
			Date.UTC(2026, 2, 1)
		])
	})

	test('constructs mixed positional series with sparse explicit gaps and stable axes', () => {
		const config = {
			...baseConfig,
			type: 'combo',
			axes: {
				x: { field: 'timestamp', label: 'Date', type: 'time' as const },
				yAxes: [
					{ id: 'usd', fields: ['tvl', 'fees'], label: 'USD', position: 'left' as const, valueSymbol: '$' },
					{ id: 'apy', fields: ['apy'], label: 'APY', position: 'right' as const, valueSymbol: '%' }
				]
			},
			series: [
				{
					...baseSeries,
					name: 'TVL',
					type: 'line' as const,
					yAxisId: 'usd',
					dataMapping: { xField: 'timestamp', yField: 'tvl' },
					styling: { color: '#111111' }
				},
				{
					...baseSeries,
					name: 'Fees',
					type: 'bar' as const,
					yAxisId: 'usd',
					metricClass: 'flow' as const,
					dataMapping: { xField: 'timestamp', yField: 'fees' },
					styling: { color: '#222222' }
				},
				{
					...baseSeries,
					name: 'APY',
					type: 'area' as const,
					yAxisId: 'apy',
					dataMapping: { xField: 'timestamp', yField: 'apy' },
					styling: { color: '#333333' }
				}
			],
			dataTransformation: { timeField: 'timestamp', metrics: ['tvl', 'fees', 'apy'] }
		} satisfies ChartConfiguration

		const result = adaptCartesianChartData(config, [
			{ timestamp: 3, tvl: 12, fees: null, apy: 4 },
			{ timestamp: 1, tvl: 10, fees: 2, apy: null },
			{ timestamp: 2, tvl: null, fees: 3 }
		])

		expect(result.props.dataset).toEqual({
			dimensions: ['timestamp', 'TVL', 'Fees', 'APY'],
			source: [
				[1000, 10, 2, null],
				[2000, null, 3, null],
				[3000, 12, undefined, 4]
			]
		})
		expect(result.props.charts).toMatchObject([
			{ name: 'TVL', type: 'line', color: '#111111', yAxisIndex: 0 },
			{ name: 'Fees', type: 'bar', color: '#222222', yAxisIndex: 0 },
			{ name: 'APY', type: 'line', color: '#333333', yAxisIndex: 1 }
		])
		expect(result.seriesMeta.map(({ baseType, valueSymbol }) => [baseType, valueSymbol])).toEqual([
			['line', '$'],
			['bar', '$'],
			['area', '%']
		])
	})

	test('filters candlestick rows with invalid timestamps before building indicators', () => {
		const timestamp = Date.UTC(2026, 0, 1)
		const config = {
			...baseConfig,
			type: 'candlestick',
			axes: { ...baseConfig.axes, x: { field: 'timestamp', label: 'Date', type: 'time' as const } },
			series: [
				{
					...baseSeries,
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

	describe.each(['UTC', 'Asia/Tokyo', 'America/Los_Angeles'])('zone-less date-times in %s', (timeZone) => {
		const originalTimeZone = process.env.TZ
		afterEach(() => {
			process.env.TZ = originalTimeZone
		})

		test('reads them as UTC so a point never moves to another day or period', () => {
			process.env.TZ = timeZone
			const config = {
				...baseConfig,
				type: 'line',
				axes: { ...baseConfig.axes, x: { field: 'date', label: 'Date', type: 'time' as const } },
				series: [{ ...baseSeries, type: 'line' as const, dataMapping: { xField: 'date', yField: 'y' } }]
			} satisfies ChartConfiguration
			const candlestickConfig = {
				...baseConfig,
				type: 'candlestick',
				axes: { ...baseConfig.axes, x: { field: 'timestamp', label: 'Date', type: 'time' as const } },
				series: [
					{ ...baseSeries, type: 'candlestick' as const, dataMapping: { xField: 'timestamp', yField: 'close' } }
				],
				dataTransformation: { timeField: 'timestamp', metrics: ['open', 'high', 'low', 'close'] }
			} satisfies ChartConfiguration

			const line = adaptCartesianChartData(config, [
				{ date: '2026-09-01T00:00:00', y: 1 },
				{ date: '2026-09-01T12:00:00+09:00', y: 2 }
			])
			const candles = adaptCandlestickData(candlestickConfig, [
				{ timestamp: '2026-09-01T00:00:00', open: 1, high: 2, low: 0, close: 1 }
			])

			expect(line.props.dataset.source.map((row) => row[0])).toEqual([Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 1, 3)])
			expect(candles.data[0]?.[0]).toBe(Date.UTC(2026, 8, 1))
		})
	})
})
