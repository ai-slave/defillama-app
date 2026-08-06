import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl, segmentedControlTabIds } from '../SegmentedControl'

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
	it('gives the first enabled option the tab stop when no value is selected', () => {
		const html = renderControl({ disabled: ['previous'] })

		expect(buttonMarkup(html, 'Previous')).toContain('tabindex="-1"')
		expect(buttonMarkup(html, 'Next')).toContain('tabindex="0"')
	})

	it('keeps the selected enabled option as the only tab stop', () => {
		const html = renderControl({ value: 'next' })

		expect(buttonMarkup(html, 'Previous')).toContain('tabindex="-1"')
		expect(buttonMarkup(html, 'Next')).toContain('tabindex="0"')
	})

	it('does not create a tab stop when every option is disabled', () => {
		const html = renderControl({ disabled: ['previous', 'next'] })

		expect(html).not.toContain('tabindex="0"')
	})

	it('chooses radio semantics by default', () => {
		const html = renderControl({ value: 'next' })

		expect(html).toContain('role="radiogroup"')
		expect(buttonMarkup(html, 'Next')).toContain('aria-checked="true"')
	})

	it('names and addresses the selected panel under tabs semantics', () => {
		const html = renderToStaticMarkup(
			<SegmentedControl
				value="next"
				onValueChange={vi.fn()}
				options={OPTIONS}
				label="Pagination"
				variant="default"
				size="md"
				semantics="tabs"
				panelIdPrefix="demo"
			/>
		)
		const { tabId, panelId } = segmentedControlTabIds('demo', 'next')

		expect(html).toContain('role="tablist"')
		expect(buttonMarkup(html, 'Next')).toContain('role="tab"')
		expect(buttonMarkup(html, 'Next')).toContain('aria-selected="true"')
		expect(buttonMarkup(html, 'Next')).toContain(`id="${tabId}"`)
		expect(buttonMarkup(html, 'Next')).toContain(`aria-controls="${panelId}"`)
		// The unselected panel is not in the document, so its tab must not claim one.
		expect(buttonMarkup(html, 'Previous')).not.toContain('aria-controls')
	})

	it('refuses tabs semantics without a panel id to point at', () => {
		expect(() =>
			renderToStaticMarkup(
				<SegmentedControl
					value="next"
					onValueChange={vi.fn()}
					options={OPTIONS}
					label="Pagination"
					variant="default"
					size="md"
					semantics="tabs"
				/>
			)
		).toThrow(/panelIdPrefix/)
	})

	it('anchors optional tooltip content around the complete button', () => {
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

		expect(html).toMatch(/<span[^>]*><button[^>]*aria-label="Daily"[^>]*>D<\/button><\/span>/)
	})
})
