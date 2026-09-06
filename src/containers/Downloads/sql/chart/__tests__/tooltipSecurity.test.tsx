// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	createCappedRemainderTooltipFormatter,
	createCategoryTooltipFormatter,
	createInflowsTooltipFormatter,
	createTooltipFormatter
} from '~/components/ECharts/MultiSeriesChart/tooltip'

type TooltipOption = { tooltip?: { formatter: (params: unknown) => string } }

const mocks = vi.hoisted(() => ({
	instance: {
		setOption: vi.fn<(option: TooltipOption) => void>(),
		on: vi.fn(),
		off: vi.fn(),
		dispose: vi.fn(),
		resize: vi.fn(),
		isDisposed: () => false
	},
	lifecycle: { restore: vi.fn(), capture: vi.fn() }
}))

vi.mock('echarts/core', () => ({ init: () => mocks.instance, use: vi.fn() }))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false] }))
vi.mock('~/hooks/useChartResize', () => ({ useChartResize: () => undefined }))
vi.mock('~/components/ECharts/renderVisibility', () => ({
	withEChartsRenderVisibility: (component: unknown) => component,
	usePersistentEChartsLifecycle: () => mocks.lifecycle
}))

import HBarChart from '~/components/ECharts/HBarChart'
import TreemapChart from '~/components/ECharts/TreemapChart'

const LABEL = `<img src=data:, onerror=globalThis.sqlReviewMarker=1>& "quoted" 'label'`
const MARKER = '<span data-chart-marker="true">•</span>'

function expectLabelIsText(html: string, label = LABEL) {
	const tooltip = document.createElement('div')
	tooltip.innerHTML = html
	expect(tooltip.querySelector('img, svg, script, [onerror], [onload]')).toBeNull()
	expect(tooltip.textContent).toContain(label)
	return tooltip
}

function chartFormatter() {
	const option = mocks.instance.setOption.mock.calls.map(([value]) => value).findLast((value) => value.tooltip)
	if (!option?.tooltip) throw new Error('Chart did not register its tooltip formatter')
	return option.tooltip.formatter
}

describe('SQL chart tooltip HTML boundaries', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		vi.clearAllMocks()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

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

	test.each([false, true])('escapes horizontal bar category and series labels (grouped=%s)', async (grouped) => {
		await act(async () => {
			root.render(
				<HBarChart
					categories={[LABEL]}
					values={[7]}
					{...(grouped
						? {
								series: [
									{ name: LABEL, values: [7], color: '#123456' },
									{ name: 'Other', values: [2], color: '#654321' }
								]
							}
						: {})}
				/>
			)
		})
		const html = chartFormatter()([{ name: LABEL, seriesName: LABEL, marker: MARKER, value: 7 }])
		expect(expectLabelIsText(html).textContent).toContain('$7')
	})

	test.each(['narrative', 'rwa'] as const)('escapes grouped treemap labels in the %s formatter', async (variant) => {
		await act(async () => {
			root.render(
				<TreemapChart
					treeData={[{ name: 'Group', value: [7, 0, 0], children: [{ name: LABEL, value: [7, 0, 0] }] }]}
					variant={variant}
					valueLabel={LABEL}
				/>
			)
		})
		const html = chartFormatter()({
			treePathInfo: [{ name: 'All' }, { name: 'Group' }, { name: LABEL }],
			name: LABEL,
			value: [7, 0, 0]
		})
		expect(expectLabelIsText(html).textContent).toContain('7')
	})

	test('preserves encoded-looking labels as literal text without double decoding', () => {
		const label = '&lt;img src=x onerror=alert(1)&gt;'
		const html = createCappedRemainderTooltipFormatter({ valueSymbol: '' })([{ seriesName: label, value: 7 }])
		expect(expectLabelIsText(html, label).textContent).toContain('7')
	})
})
