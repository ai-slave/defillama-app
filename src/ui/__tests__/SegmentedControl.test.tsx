// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { SegmentedControl } from '../SegmentedControl'
import { Tabs, TabPanel } from '../Tabs'

const OPTIONS = [
	{ value: 'previous', label: 'Previous' },
	{ value: 'next', label: 'Next' }
] as const

test('server-rendered radios expose labels, selection and disabled state before hydration', () => {
	const html = renderToStaticMarkup(
		<SegmentedControl
			value="next"
			onValueChange={vi.fn()}
			options={[
				{ ...OPTIONS[0], disabled: true },
				{ ...OPTIONS[1], label: 'N', ariaLabel: 'Next', tooltip: 'Next page' }
			]}
			label="Pagination"
			variant="default"
			size="md"
		/>
	)
	const document = new DOMParser().parseFromString(html, 'text/html')
	const group = document.querySelector('[role="radiogroup"]')!
	expect(group.getAttribute('aria-label')).toBe('Pagination')
	const radios = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	expect(radios).toHaveLength(2)
	expect(radios.map((radio) => radio.checked)).toEqual([false, true])
	expect(radios.map((radio) => radio.disabled)).toEqual([true, false])
	expect(radios[0].labels?.[0].textContent).toBe('Previous')
	expect(radios[1].getAttribute('aria-label')).toBe('Next')
})

test('server-rendered selected panel is named by its tab before hydration', () => {
	const html = renderToStaticMarkup(
		<Tabs value="next" onValueChange={vi.fn()} values={['previous', 'next']}>
			<SegmentedControl options={OPTIONS} label="Pagination" variant="default" size="md" semantics="tabs" />
			<TabPanel value="next">Next panel</TabPanel>
		</Tabs>
	)
	const document = new DOMParser().parseFromString(html, 'text/html')
	const panel = document.querySelector('[role="tabpanel"]')!
	const selectedTab = document.querySelector('[role="tab"][aria-selected="true"]')!
	expect(selectedTab.textContent).toBe('Next')
	expect(selectedTab.id).not.toBe('')
	expect(document.getElementById(panel.getAttribute('aria-labelledby')!)).toBe(selectedTab)
	expect(panel.textContent).toBe('Next panel')
	// The unselected panel is not in the document, so its tab must not claim one.
	expect(document.querySelector('[role="tab"][aria-selected="false"]')!.hasAttribute('aria-controls')).toBe(false)
})
