// @vitest-environment happy-dom

import { describe, expect, test } from 'vitest'
import { formatHBarTooltip } from '~/components/ECharts/HBarChart/tooltip'
import {
	createCappedRemainderTooltipFormatter,
	createCategoryTooltipFormatter,
	createInflowsTooltipFormatter,
	createTooltipFormatter
} from '~/components/ECharts/MultiSeriesChart/tooltip'
import { formatNarrativeTreemapTooltip } from '~/components/ECharts/TreemapChart/formatters'
import { formatRwaTreemapTooltip } from '~/components/ECharts/TreemapChart/rwaFormatting'

const LABEL = `<img src=data:, onerror=globalThis.sqlReviewMarker=1>& "quoted" 'label'`
const MARKER = '<span data-chart-marker="true">•</span>'

function expectLabelIsText(html: string, label = LABEL) {
	const tooltip = document.createElement('div')
	tooltip.innerHTML = html
	expect(tooltip.querySelector('img, svg, script, [onerror], [onload]')).toBeNull()
	expect(tooltip.textContent).toContain(label)
	return tooltip
}

describe('SQL chart tooltip HTML boundaries', () => {
	test.each([
		['time series', createCappedRemainderTooltipFormatter({ valueSymbol: '$', explicitRemainderLabel: null })],
		['category series', createCategoryTooltipFormatter('$')],
		['inflows', createInflowsTooltipFormatter({ valueSymbol: '$' })],
		['default series', createTooltipFormatter({ groupBy: 'daily', valueSymbol: '$' })]
	] as const)('renders malicious SQL labels as text in %s tooltips', (_name, formatter) => {
		const html = formatter([
			{ name: LABEL, axisValue: LABEL, seriesName: LABEL, marker: MARKER, value: [1_767_225_600_000, 7] }
		])
		const tooltip = expectLabelIsText(html)
		expect(tooltip.querySelector('[data-chart-marker]')).not.toBeNull()
		expect(tooltip.textContent).toContain('$7')
	})

	test.each([false, true])('escapes horizontal bar category and series labels (grouped=%s)', (grouped) => {
		const html = formatHBarTooltip([{ name: LABEL, seriesName: LABEL, marker: MARKER, value: 7 }], grouped, '$')
		expect(expectLabelIsText(html).textContent).toContain('$7')
	})

	test('escapes RWA treemap path and value labels', () => {
		const html = formatRwaTreemapTooltip({
			info: { treePathInfo: [{ name: 'All' }, { name: LABEL }, { name: LABEL }], name: LABEL, value: [7, 0, 0] },
			valueLabel: LABEL,
			formatMetricValue: (value) => `${value}`
		})
		expect(expectLabelIsText(html).textContent).toContain(`Parent: ${LABEL}Child: ${LABEL}${LABEL}: 7`)
	})

	test('escapes grouped treemap labels in the narrative formatter', () => {
		const html = formatNarrativeTreemapTooltip([{ name: 'All' }, { name: 'Group' }, { name: LABEL }], [7, 0, 0])
		expect(expectLabelIsText(html).textContent).toBe(`${LABEL}Return: 0%Market Cap: $7`)
	})

	test('preserves encoded-looking labels as literal text without double decoding', () => {
		const label = '&lt;img src=x onerror=alert(1)&gt;'
		const html = createCappedRemainderTooltipFormatter({ valueSymbol: '' })([{ seriesName: label, value: 7 }])
		expect(expectLabelIsText(html, label).textContent).toContain('7')
	})
})
