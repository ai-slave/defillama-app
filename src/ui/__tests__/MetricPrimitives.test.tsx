import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { MetricRow, MetricSection } from '../MetricPrimitives'

describe('MetricPrimitives export markers', () => {
	test('marks an ordinary metric label and value independently of typography classes', () => {
		const html = renderToStaticMarkup(<MetricRow label="Fees (Annualized)" value="$4,609" />)

		expect(html).toContain('<span class="body-md text-secondary" data-metric-label="true">Fees (Annualized)</span>')
		expect(html).toContain('<span class="mono-md-bold ml-auto" data-metric-value="true">$4,609</span>')
	})

	test('marks tooltip labels and expandable-section values with custom markup', () => {
		const html = renderToStaticMarkup(
			<MetricSection label="Perp Volume 30d" tooltip="Thirty-day volume" value={<strong>$1.33m</strong>}>
				<div>Breakdown</div>
			</MetricSection>
		)

		expect(html).toContain('data-metric-label="true">Perp Volume 30d</span>')
		expect(html).toContain('data-metric-value="true"><strong>$1.33m</strong></span>')
	})

	test('uses a keyboard-focusable trigger for ordinary metric help', () => {
		const html = renderToStaticMarkup(<MetricRow label="Reserves" tooltip="Assets, not liabilities" value="$1m" />)

		expect(html).toContain('<button type="button"')
		expect(html).toContain('data-metric-label="true">Reserves</span>')
	})
})
