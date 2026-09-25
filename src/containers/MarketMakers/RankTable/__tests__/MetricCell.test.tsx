import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { MetricCell } from '../MetricCell'

const metric = { value: 266_553_520, percentile: 42.6, rank: 3 }
const market = { value: 25, percentile: 25, rank: 2 }

function text(element: ReactElement) {
	return renderToStaticMarkup(element)
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

test('shows the value, percentile or rank for the active mode with its market-share twin', () => {
	expect(text(<MetricCell metric={metric} market={market} mode="value" kind="usd" rowCount={20} />)).toBe(
		'$266.55M 25% of Market'
	)
	expect(text(<MetricCell metric={metric} market={market} mode="percentile" kind="usd" rowCount={20} />)).toBe(
		'Value: 43% % of Market: 25%'
	)
	expect(text(<MetricCell metric={metric} market={market} mode="rank" kind="usd" rowCount={20} />)).toBe(
		'Value Rank: 3 % of Market: 2'
	)
})

test('shows the bare metric without a twin and N/A without a metric', () => {
	expect(text(<MetricCell metric={metric} mode="rank" kind="usd" rowCount={20} />)).toBe('3')
	expect(text(<MetricCell metric={{ ...metric, rank: null }} mode="rank" kind="usd" rowCount={20} />)).toBe('N/A')
	expect(text(<MetricCell metric={null} mode="value" kind="usd" rowCount={20} />)).toBe('N/A')
})
