// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { LlamaAITab } from '../LlamaAITab'

const session = installSubscriberSession('u1', { resolved: true })
const chart = (id: string, title: string) => ({
	id,
	title,
	original_query: `Show ${title}`,
	created_at: '2026-09-01',
	access_count: 1
})
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderTab(deleteResponse: () => Response) {
	let charts = [chart('c1', 'Aave TVL'), chart('c2', 'Uniswap fees')]
	session.serve({
		[`${AI_SERVER}/charts`]: (url: URL, init?: RequestInit) => {
			if (init?.method !== 'DELETE') return { charts }
			const response = deleteResponse()
			if (response.ok) charts = charts.filter((saved) => !url.pathname.endsWith(saved.id))
			return response
		}
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<LlamaAITab selectedChart={null} onChartSelect={vi.fn()} />
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(deleteButton('Aave TVL')).not.toBeNull())
}
const deleteButton = (title: string) => document.querySelector<HTMLButtonElement>(`[aria-label="Delete ${title}"]`)
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]')
async function confirmDelete() {
	await act(async () => deleteButton('Aave TVL')!.click())
	await waitForUi(() => expect(confirmation()?.textContent).toContain('Delete chart?'))
	const confirm = [...confirmation()!.querySelectorAll('button')].find((button) => button.textContent === 'Delete')!
	await act(async () => confirm.click())
}

test('a failed delete keeps the confirmation open with an error, and keeps the chart', async () => {
	await renderTab(() => new Response(null, { status: 500 }))
	await confirmDelete()
	await waitForUi(() => expect(alertTexts(confirmation()!)).toHaveLength(1))
	expect(deleteButton('Aave TVL')).not.toBeNull()
})

test('a confirmed delete removes the chart and hands focus to the search field', async () => {
	await renderTab(() => new Response(null, { status: 204 }))
	await confirmDelete()
	await waitForUi(() => expect(deleteButton('Aave TVL')).toBeNull())
	expect(deleteButton('Uniswap fees')).not.toBeNull()
	await waitForUi(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Search saved charts'))
})

test('a failed refresh keeps the loaded charts and an open delete confirmation', async () => {
	await renderTab(() => new Response(null, { status: 500 }))
	await act(async () => deleteButton('Aave TVL')!.click())
	await waitForUi(() => expect(confirmation()?.textContent).toContain('Delete chart?'))

	session.serve({ [`${AI_SERVER}/charts`]: () => new Response(null, { status: 503 }) })
	await act(async () => session.client.refetchQueries({ queryKey: ['pro-dashboard', 'saved-charts-list'] }))
	// The query reports its failure to the tab on the next tick.
	await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))

	expect(deleteButton('Uniswap fees')).not.toBeNull()
	expect(confirmation()?.textContent).toContain('Delete chart?')
	expect(alertTexts(container)).toEqual([])
})
