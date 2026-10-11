// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, onTestFinished, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { TablePager } from '../TablePager'

async function render(node: React.ReactNode) {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	await act(async () => root.render(node))
	onTestFinished(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	return container
}

const button = (container: HTMLElement, name: string) =>
	[...container.querySelectorAll('button')].find((node) => accessibleName(node) === name)!

function Pager({ pageCount, failed = false }: { pageCount: number; failed?: boolean }) {
	const [pageIndex, setPageIndex] = useState(0)
	return (
		<section tabIndex={-1} aria-label="Dashboards">
			{failed ? <p role="alert">The page failed.</p> : null}
			{failed ? null : <TablePager pageIndex={pageIndex} pageCount={pageCount} onPageChange={setPageIndex} />}
		</section>
	)
}

test('moves between pages and holds each end button, still focusable, at its end', async () => {
	const container = await render(<Pager pageCount={3} />)
	expect(button(container, 'Go to previous page').getAttribute('aria-disabled')).toBe('true')

	button(container, 'Go to last page').focus()
	await act(async () => button(container, 'Go to last page').click())
	expect(container.textContent).toContain('Page 3 of 3')
	expect(button(container, 'Go to next page').getAttribute('aria-disabled')).toBe('true')
	// The button that reached the end keeps focus while it disables itself.
	expect(document.activeElement).toBe(button(container, 'Go to last page'))

	await act(async () => button(container, 'Go to previous page').click())
	expect(container.textContent).toContain('Page 2 of 3')
})

test('reads a row range when the owner gives one, and renders nothing for a single page', async () => {
	const container = await render(
		<>
			<TablePager pageIndex={2} pageCount={17} onPageChange={() => {}} range={{ from: 41, to: 60, total: 340 }} />
			<div data-single>
				<TablePager pageIndex={0} pageCount={1} onPageChange={() => {}} />
			</div>
		</>
	)
	expect(container.textContent).toContain('41–60 of 340')
	expect(container.querySelector('[data-single] button')).toBeNull()
})

test('a page past the end, as a stale ?page= gives, reads as the last page', async () => {
	const container = await render(<TablePager pageIndex={7} pageCount={3} onPageChange={() => {}} />)
	expect(container.textContent).toContain('Page 3 of 3')
})

test('a pager that leaves with focus hands it to the region around it', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	onTestFinished(async () => {
		await act(async () => root.unmount())
		container.remove()
	})
	await act(async () => root.render(<Pager pageCount={3} />))
	button(container, 'Go to next page').focus()

	await act(async () => root.render(<Pager pageCount={3} failed />))
	expect(document.activeElement).toBe(container.querySelector('section'))
})
