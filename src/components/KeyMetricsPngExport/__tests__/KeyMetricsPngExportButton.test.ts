// @vitest-environment happy-dom

import { expect, test } from 'vitest'
import { extractRows } from '../KeyMetricsPngExportButton'

function container(html: string): HTMLDivElement {
	const el = document.createElement('div')
	el.innerHTML = html
	return el
}

test('reads the label from a tooltip row where the label span is nested in a button', () => {
	const rows = extractRows(
		container(`
			<p>
				<button type="button"><span data-metric-label>Fully Diluted Valuation</span></button>
				<span data-metric-value>$392.81m</span>
			</p>
		`)
	)
	expect(rows).toEqual([{ label: 'Fully Diluted Valuation', value: '$392.81m' }])
})

test('reads plain rows and dropdown summary rows', () => {
	const rows = extractRows(
		container(`
			<p><span data-metric-label>Market Cap</span><span data-metric-value>$327.66m</span></p>
			<details>
				<summary><span data-metric-label>Fees 30d</span><span data-metric-value>$41.96m</span></summary>
				<p><span data-metric-label>Hidden</span><span data-metric-value>$1</span></p>
			</details>
		`)
	)
	expect(rows).toEqual([
		{ label: 'Market Cap', value: '$327.66m' },
		{ label: 'Fees 30d', value: '$41.96m' }
	])
})
