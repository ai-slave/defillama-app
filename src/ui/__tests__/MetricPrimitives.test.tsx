// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { extractRows } from '~/components/KeyMetricsPngExport/KeyMetricsPngExportButton'
import { MetricRow, MetricSection } from '../MetricPrimitives'

describe('MetricPrimitives export markers', () => {
	// The Key Metrics PNG export reads rows from this markup, so assert what the export extracts.
	test('exports plain, tooltip, and expandable-section rows from real markup', () => {
		const output = document.createElement('div')
		output.innerHTML = renderToStaticMarkup(
			<>
				<MetricRow label="Fees (Annualized)" value="$4,609" />
				<MetricRow label="Reserves" tooltip="Assets, not liabilities" value="$1m" />
				<MetricSection label="Perp Volume 30d" tooltip="Thirty-day volume" value={<strong>$1.33m</strong>}>
					<div>Breakdown</div>
				</MetricSection>
			</>
		)

		expect(extractRows(output)).toEqual([
			{ label: 'Fees (Annualized)', value: '$4,609' },
			{ label: 'Reserves', value: '$1m' },
			{ label: 'Perp Volume 30d', value: '$1.33m' }
		])
	})

	test('uses a keyboard-focusable trigger for ordinary metric help', () => {
		const html = renderToStaticMarkup(<MetricRow label="Reserves" tooltip="Assets, not liabilities" value="$1m" />)

		const output = document.createElement('div')
		output.innerHTML = html
		const trigger = output.querySelector('button')!
		expect(trigger.textContent).toBe('Reserves')
		expect(trigger.tabIndex).toBe(0)
	})
})
