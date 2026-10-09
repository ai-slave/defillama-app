// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { fieldErrorOf } from '~/utils/testing/fieldErrors'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ArticleChartConfig } from '../../types'
import { ArticleChartPickerDialog } from '../ArticleChartPicker'
vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/research/editor', query: {} }) }))
const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	const protocols = ['Aave', 'Compound', 'Curve', 'Lido', 'Uniswap']
	http.serve({
		'/api/dynamic/pro-dashboard/protocol-catalog-source': protocols.map((name) => ({
			name,
			slug: name.toLowerCase(),
			parentSlug: name.toLowerCase(),
			tvl: 100,
			category: 'Lending',
			symbol: null,
			geckoId: null,
			hasMisrepresentedTokens: false,
			excludeTvlFromParent: false
		})),
		'/lite/protocols2': { protocols: [], parentProtocols: [] },
		'/chains': [{ name: 'Ethereum', tvl: 1000, gecko_id: 'ethereum', tokenSymbol: 'ETH', chainId: 1 }],
		'/config/smol/appMetadata-protocols.json': Object.fromEntries(
			protocols.map((name) => [
				name.toLowerCase(),
				{ name: name.toLowerCase(), displayName: name, tvl: true, fees: true }
			])
		),
		'/config/smol/appMetadata-chains.json': { ethereum: { name: 'Ethereum', id: 'ethereum', tvl: true, fees: true } },
		'/api/public/pro-dashboard/pf-ps-protocols': { pf: [], ps: [] },
		[`${V2_SERVER_URL}/chart/tvl/protocol/`]: [],
		[`${V2_SERVER_URL}/chart/fees/protocol/`]: [],
		'/lite/charts/Ethereum': []
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})
async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 0))
}
async function mount(props: Partial<ComponentProps<typeof ArticleChartPickerDialog>> = {}) {
	const onInsert = vi.fn()
	function Harness() {
		const store = Ariakit.useDialogStore({ defaultOpen: true })
		return (
			<QueryClientProvider client={client}>
				<AppMetadataProvider>
					<ArticleChartPickerDialog store={store} onInsert={onInsert} {...props} />
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	}
	await act(async () => {
		root.render(<Harness />)
		await settle()
	})
	// The protocol rows arrive from the fixture after the first render; under load that takes more than one tick.
	await waitForUi(() => expect(document.querySelector('[role="checkbox"]')).not.toBeNull())
	return onInsert
}
// A radio is named by the label that wraps it.
function radio(group: string, label: string) {
	return [
		...document.querySelectorAll<HTMLInputElement>(`[role="radiogroup"][aria-label="${group}"] input[type="radio"]`)
	].find((el) => el.closest('label')!.textContent === label)!
}
function entity(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')].find((el) =>
		el.textContent!.includes(name)
	)!
}
function insert() {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.textContent?.includes('Insert chart') || el.textContent?.includes('Update chart')
	)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.click()
		await settle()
	})
}
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.focus()
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
		await settle()
	})
}
function searchField(name: string) {
	const label = [...document.querySelectorAll('label')].find((node) => node.textContent === name)!
	return document.getElementById(label.htmlFor) as HTMLInputElement
}
async function input(el: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
		el.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('entity filters clear search while preserving chart settings and selected series', async () => {
	const onInsert = await mount()
	expect(radio('Entity type', 'Protocols').checked).toBe(true)
	expect(document.activeElement).toBe(searchField('Search protocols'))
	const search = searchField('Search protocols')
	await press(radio('Entity type', 'Protocols'), 'Home')
	await click(insert())
	expect(onInsert).not.toHaveBeenCalled()
	expect(fieldErrorOf(search)).toBe('Choose at least one series.')
	expect(document.activeElement).toBe(search)
	await click(entity('Aave'))
	expect(search.getAttribute('aria-invalid')).toBeNull()
	expect(radio('Range', 'All').checked).toBe(true)
	expect(radio('Y-axis scale', 'Linear').checked).toBe(true)
	await press(radio('Range', 'All'), 'Home')
	expect(radio('Range', '30D').checked).toBe(true)
	expect(document.activeElement).toBe(radio('Range', '30D'))
	await press(radio('Y-axis scale', 'Linear'), 'ArrowRight')
	expect(radio('Y-axis scale', 'Log').checked).toBe(true)
	await input(searchField('Search protocols'), 'Aave')
	await press(radio('Entity type', 'Protocols'), 'ArrowRight')
	expect(document.activeElement).toBe(radio('Entity type', 'Chains'))
	expect(searchField('Search chains').value).toBe('')
	expect(radio('Range', '30D').checked).toBe(true)
	expect(radio('Y-axis scale', 'Log').checked).toBe(true)
	await click(entity('Ethereum'))
	await press(radio('Entity type', 'Chains'), 'Home')
	expect(entity('Aave').getAttribute('aria-checked')).toBe('true')
	expect(onInsert).not.toHaveBeenCalled()
	await click(insert())
	expect(onInsert).toHaveBeenCalledExactlyOnceWith(
		expect.objectContaining({
			series: [
				expect.objectContaining({ slug: 'aave', entityType: 'protocol', chartType: 'tvl' }),
				expect.objectContaining({ slug: 'Ethereum', entityType: 'chain', chartType: 'tvl' })
			],
			range: '30d',
			logScale: true
		})
	)
})

test('a series takes the chart type picked from its select', async () => {
	const onInsert = await mount()
	await click(entity('Aave'))
	const trigger = () => document.querySelector<HTMLElement>('[aria-label="Chart type for Aave"]')!
	expect(trigger().textContent).toBe('TVL')
	await click(trigger())
	await waitForUi(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent === 'Fees')!
	await click(option)
	expect(trigger().textContent).toBe('Fees')
	await click(insert())
	expect(onInsert.mock.calls[0][0].series).toEqual([
		expect.objectContaining({ slug: 'aave', entityType: 'protocol', chartType: 'fees' })
	])
})

test('the range and scale radio groups are named by their visible labels', async () => {
	await mount()
	await click(entity('Aave'))
	const names = [...document.querySelectorAll('[role="radiogroup"][aria-labelledby]')].map(
		(group) => document.getElementById(group.getAttribute('aria-labelledby')!)!.textContent
	)
	expect(names).toEqual(['Range', 'Y-axis scale'])
})

test('series limit disables additions but selected series remain removable to empty', async () => {
	await mount()
	await click(entity('Aave'))
	await click(entity('Compound'))
	await click(entity('Curve'))
	await click(entity('Lido'))
	expect(entity('Uniswap').disabled).toBe(true)
	await click(entity('Uniswap'))
	expect(document.querySelectorAll('[role="checkbox"][aria-checked="true"]')).toHaveLength(4)
	expect(entity('Aave').disabled).toBe(false)
	await press(entity('Aave'), ' ')
	expect(entity('Uniswap').disabled).toBe(false)
	await click(entity('Compound'))
	await click(entity('Curve'))
	await click(entity('Lido'))
	expect(document.querySelectorAll('[role="checkbox"][aria-checked="true"]')).toHaveLength(0)
})

test('editing retains caption and annotations; All and Linear omit optional settings', async () => {
	const config: ArticleChartConfig = {
		entities: [{ entityType: 'protocol', slug: 'aave', name: 'Aave' }],
		chartType: 'tvl',
		series: [{ entityType: 'protocol', slug: 'aave', name: 'Aave', chartType: 'tvl' }],
		range: '90d',
		logScale: true,
		caption: 'Existing caption',
		annotations: [{ date: '2026-01-01T00:00:00.000Z', label: 'Launch' }]
	}
	const onInsert = await mount({ initialConfig: config })
	expect(radio('Range', '90D').checked).toBe(true)
	expect(radio('Y-axis scale', 'Log').checked).toBe(true)
	await press(radio('Range', '90D'), 'End')
	await press(radio('Y-axis scale', 'Log'), 'Home')
	await click(insert())
	expect(onInsert).toHaveBeenCalledTimes(1)
	const saved = onInsert.mock.calls[0][0]
	expect(saved).not.toHaveProperty('range')
	expect(saved).not.toHaveProperty('logScale')
	expect(saved.caption).toBe('Existing caption')
	expect(saved.annotations).toEqual(config.annotations)
})

test('retains a duplicate annotation input after deleting its preceding row', async () => {
	const onInsert = await mount({
		initialConfig: {
			entities: [{ entityType: 'protocol', slug: 'aave', name: 'Aave' }],
			series: [{ entityType: 'protocol', slug: 'aave', name: 'Aave', chartType: 'tvl' }],
			chartType: 'tvl',
			annotations: [
				{ date: '2026-01-01', label: 'Same' },
				{ date: '2026-01-01', label: 'Same' }
			]
		}
	})
	const surviving = document.querySelector<HTMLInputElement>('[aria-label="Annotation 2 label"]')!
	await click(document.querySelector<HTMLButtonElement>('[aria-label="Remove annotation 1"]')!)
	expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
	await input(surviving, '')
	expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
	await input(surviving, 'Retained')
	expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
	await click(insert())
	expect(onInsert.mock.calls[0][0].annotations).toEqual([{ date: '2026-01-01T00:00:00.000Z', label: 'Retained' }])
})

test('a preview whose data fails to load says so as an error, not as missing data', async () => {
	http.serve({ [`${V2_SERVER_URL}/chart/fees/protocol/`]: () => new Response('down', { status: 500 }) })
	await mount({
		initialConfig: {
			entities: [{ entityType: 'protocol', slug: 'aave', name: 'Aave' }],
			series: [{ entityType: 'protocol', slug: 'aave', name: 'Aave', chartType: 'fees' }],
			chartType: 'fees'
		}
	})
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Could not load chart data'))
})

test('each remove button names the row it removes', async () => {
	const onInsert = await mount({
		initialConfig: {
			entities: [{ entityType: 'protocol', slug: 'aave', name: 'Aave' }],
			series: [
				{ entityType: 'protocol', slug: 'aave', name: 'Aave', chartType: 'tvl' },
				{ entityType: 'protocol', slug: 'aave', name: 'Aave', chartType: 'fees' }
			],
			chartType: 'tvl',
			annotations: [
				{ date: '2026-01-01', label: 'Launch' },
				{ date: '2026-02-01', label: 'Launch' }
			]
		}
	})
	const removeNames = () =>
		[...document.querySelectorAll('button[aria-label^="Remove "]')].map((el) => el.getAttribute('aria-label'))
	expect(removeNames()).toEqual(['Remove Aave TVL', 'Remove Aave Fees', 'Remove annotation 1', 'Remove annotation 2'])
	await click(document.querySelector<HTMLButtonElement>('[aria-label="Remove Aave Fees"]')!)
	await click(document.querySelector<HTMLButtonElement>('[aria-label="Remove annotation 2"]')!)
	expect(removeNames()).toEqual(['Remove Aave TVL', 'Remove annotation 1'])
	await click(insert())
	expect(onInsert.mock.calls[0][0]).toEqual(
		expect.objectContaining({
			series: [expect.objectContaining({ slug: 'aave', chartType: 'tvl' })],
			annotations: [{ date: '2026-01-01T00:00:00.000Z', label: 'Launch' }]
		})
	)
})

test('Cancel closes an untouched picker at once, and asks before it drops picked series', async () => {
	await mount()
	const dialog = () => document.querySelector('[role="dialog"]:not([hidden])')
	const button = (name: string, scope: ParentNode = document) =>
		[...scope.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === name)!
	await click(entity('Aave'))
	await waitForUi(() => expect(entity('Aave').getAttribute('aria-checked')).toBe('true'))
	await click(button('Cancel', dialog()!))
	const confirmation = await waitForUi(() => {
		const found = document.querySelector<HTMLElement>('[role="alertdialog"]')
		expect(found?.textContent).toContain('Discard this chart?')
		return found!
	})
	await click(button('Keep editing', confirmation))
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	expect(entity('Aave').getAttribute('aria-checked')).toBe('true')
	await click(entity('Aave'))
	await waitForUi(() => expect(entity('Aave').getAttribute('aria-checked')).toBe('false'))
	await click(button('Cancel', dialog()!))
	// The picker closing is the signal Cancel finished; only then is the missing confirmation meaningful.
	await waitForUi(() => expect(dialog()).toBeNull())
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
})
