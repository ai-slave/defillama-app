import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MetricCell } from '../MetricCell'

const metric = { value: 266553520, percentile: 42, rank: 3 }
const market = { value: 25, percentile: 25, rank: 2 }

describe('MetricCell', () => {
	it('shows abbreviated value and market share with no heatmap background in value mode', () => {
		const html = renderToStaticMarkup(
			<MetricCell metric={metric} market={market} mode="value" kind="usd" rowCount={20} />
		)
		expect(html).toContain('$266')
		expect(html).toContain('25% of Market')
		expect(html).not.toContain('171, 206, 192')
	})
	it('shows the rounded percentile and market share in percentile mode', () => {
		const html = renderToStaticMarkup(
			<MetricCell
				metric={{ value: 1, percentile: 42.6, rank: 3 }}
				market={market}
				mode="percentile"
				kind="usd"
				rowCount={20}
			/>
		)
		expect(html).toContain('43%')
		expect(html).toContain('% of Market: 25%')
	})
	it('shows ranks and market rank in rank mode', () => {
		const html = renderToStaticMarkup(
			<MetricCell metric={metric} market={market} mode="rank" kind="usd" rowCount={20} />
		)
		expect(html).toContain('% of Market: 2')
	})
	it('renders N/A for a null metric', () => {
		const html = renderToStaticMarkup(<MetricCell metric={null} mode="value" kind="usd" rowCount={20} />)
		expect(html).toContain('N/A')
	})
})
