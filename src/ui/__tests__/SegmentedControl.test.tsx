import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { SegmentedControl } from '../SegmentedControl'
import { Tabs, TabPanel, tabIds } from '../Tabs'

const OPTIONS = [
	{ value: 'previous', label: 'Previous' },
	{ value: 'next', label: 'Next' }
] as const

function renderControl({
	value = null,
	disabled = []
}: {
	value?: (typeof OPTIONS)[number]['value'] | null
	disabled?: Array<(typeof OPTIONS)[number]['value']>
} = {}) {
	return renderToStaticMarkup(
		<SegmentedControl
			value={value}
			onValueChange={vi.fn()}
			options={OPTIONS.map((option) => ({ ...option, disabled: disabled.includes(option.value) }))}
			label="Pagination"
			variant="default"
			size="md"
		/>
	)
}

function buttonMarkup(html: string, label: string) {
	return html.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? ''
}

describe('SegmentedControl', () => {
	test('renders native labeled radios with the controlled checked value', () => {
		const html = renderControl({ value: 'next', disabled: ['previous'] })
		expect(html).toContain('role="radiogroup"')
		expect(html).toMatch(/<label[^>]*><input[^>]*type="radio"[^>]*disabled=""[^>]*\/>Previous<\/label>/)
		expect(html).toMatch(/<label[^>]*><input[^>]*checked=""[^>]*\/>Next<\/label>/)
	})

	test('names and addresses the selected panel under tabs semantics', () => {
		const html = renderToStaticMarkup(
			<Tabs value="next" onValueChange={vi.fn()} values={['previous', 'next']} id="demo">
				<SegmentedControl options={OPTIONS} label="Pagination" variant="default" size="md" semantics="tabs" />
				<TabPanel value="next">Next panel</TabPanel>
			</Tabs>
		)
		const { tabId, panelId } = tabIds('demo', 'next')

		expect(html).toContain('role="tablist"')
		expect(buttonMarkup(html, 'Next')).toContain('role="tab"')
		expect(buttonMarkup(html, 'Next')).toContain('aria-selected="true"')
		expect(buttonMarkup(html, 'Next')).toContain(`id="${tabId}"`)
		expect(html).toContain(`id="${panelId}"`)
		// The unselected panel is not in the document, so its tab must not claim one.
		expect(buttonMarkup(html, 'Previous')).not.toContain('aria-controls')
	})

	test('anchors optional tooltip content around the complete label', () => {
		const html = renderToStaticMarkup(
			<SegmentedControl
				value="daily"
				onValueChange={vi.fn()}
				options={[{ value: 'daily', label: 'D', ariaLabel: 'Daily', tooltip: 'Daily' }]}
				label="Chart grouping"
				variant="default"
				size="md"
			/>
		)

		expect(html).toMatch(/<span[^>]*><label[^>]*><input[^>]*aria-label="Daily"[^>]*\/>D<\/label><\/span>/)
	})
})
