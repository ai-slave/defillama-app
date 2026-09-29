// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardNotice, ProCardRefreshFailed } from '../ProCardStatus'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function buttonLabelled(label: string) {
	const match = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === label)
	if (!match) throw new Error(`Expected a button labelled "${label}"`)
	return match
}

test('the loading state is busy with an accessible label and no live region', async () => {
	await act(async () => root.render(<ProCardLoading label="Loading chart…" />))
	const busy = container.querySelector('[aria-busy="true"]')
	expect(busy).not.toBeNull()
	expect(busy?.textContent).toContain('Loading chart…')
	expect(container.querySelector('[role="status"]')).toBeNull()
	expect(container.querySelector('[aria-live]')).toBeNull()
})

test('the loading state shows a skeleton for the card shape', async () => {
	await act(async () => root.render(<ProCardLoading label="Loading table…" variant="table" />))
	const busy = container.querySelector('[aria-busy="true"]')
	expect(busy?.querySelector('[data-skeleton="table"]')).not.toBeNull()
	expect(busy?.textContent).toContain('Loading table…')
})

test('the error state is an alert and calls back from Try again', async () => {
	const onRetry = vi.fn()
	await act(async () => root.render(<ProCardError detail="The request failed" onRetry={onRetry} />))
	const alert = container.querySelector('[role="alert"]')
	expect(alert?.textContent).toContain("Couldn't load this card")
	expect(alert?.textContent).toContain('The request failed')
	await act(async () => buttonLabelled('Try again').click())
	expect(onRetry).toHaveBeenCalledOnce()
})

test('the error state has no Try again without a retry callback', async () => {
	await act(async () => root.render(<ProCardError />))
	expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load this card")
	expect(container.querySelector('button')).toBeNull()
})

test('the empty state is a status and can carry one action', async () => {
	const onClick = vi.fn()
	await act(async () =>
		root.render(<ProCardEmpty message="This query hasn't run yet." action={{ label: 'Run query', onClick }} />)
	)
	expect(container.querySelector('[role="status"]')?.textContent).toContain("This query hasn't run yet.")
	await act(async () => buttonLabelled('Run query').click())
	expect(onClick).toHaveBeenCalledOnce()
})

test('the empty state has no button without an action', async () => {
	await act(async () => root.render(<ProCardEmpty message="No data available" />))
	expect(container.querySelector('[role="status"]')?.textContent).toContain('No data available')
	expect(container.querySelector('button')).toBeNull()
})

test('a warning notice is a status, an error notice is an alert and keeps details out of the text', async () => {
	const onClick = vi.fn()
	await act(async () => root.render(<ProCardNotice tone="warning">2 series are unavailable.</ProCardNotice>))
	expect(container.querySelector('[role="status"]')?.textContent).toContain('2 series are unavailable.')

	await act(async () =>
		root.render(
			<ProCardNotice tone="error" title="Refresh failed with HTTP 500" action={{ label: 'Try again', onClick }}>
				Couldn&apos;t refresh this query.
			</ProCardNotice>
		)
	)
	const alert = container.querySelector('[role="alert"]')
	expect(alert?.textContent).toContain("Couldn't refresh this query.")
	expect(alert?.textContent).not.toContain('HTTP 500')
	expect(alert?.getAttribute('title')).toBe('Refresh failed with HTTP 500')
	await act(async () => buttonLabelled('Try again').click())
	expect(onClick).toHaveBeenCalledOnce()
})

test('a permanent configuration error can be announced as a status instead of an alert', async () => {
	await act(async () => root.render(<ProCardError title="Stored rows couldn't be read" role="status" />))
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(container.querySelector('[role="status"]')?.textContent).toContain("Stored rows couldn't be read")
})

test('a failed refresh warns without hiding the data and retries', async () => {
	const onRetry = vi.fn()
	await act(async () => root.render(<ProCardRefreshFailed onRetry={onRetry} />))
	const status = container.querySelector('[role="status"]')
	expect(status?.textContent).toContain("Couldn't refresh this card")
	expect(container.querySelector('[role="alert"]')).toBeNull()
	await act(async () => buttonLabelled('Try again').click())
	expect(onRetry).toHaveBeenCalledOnce()
})
