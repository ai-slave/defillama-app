// @vitest-environment happy-dom
import * as Ariakit from '@ariakit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import type { ArticleChartConfig } from '../../types'
import { ArticleChartPickerDialog } from '../ArticleChartPicker'
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
	return onInsert
}
function radio(group: string, label: string) {
	return document.querySelector<HTMLInputElement>(
		`[role="radiogroup"][aria-label="${group}"] input[aria-label="${label}"]`
	)!
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
async function input(el: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
		el.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('entity filters clear search while preserving chart settings and selected series', async () => {
	const onInsert = await mount()
	expect(radio('Entity type', 'Protocols').checked).toBe(true)
	expect(document.activeElement).toBe(document.querySelector('[aria-label="Search protocols"]'))
	expect(insert().disabled).toBe(true)
	await click(entity('Aave'))
	expect(radio('Range', 'All').checked).toBe(true)
	expect(radio('Y-axis scale', 'Linear').checked).toBe(true)
	await press(radio('Range', 'All'), 'Home')
	expect(radio('Range', '30D').checked).toBe(true)
	expect(document.activeElement).toBe(radio('Range', '30D'))
	await press(radio('Y-axis scale', 'Linear'), 'ArrowRight')
	expect(radio('Y-axis scale', 'Log').checked).toBe(true)
	await input(document.querySelector<HTMLInputElement>('[aria-label="Search protocols"]')!, 'Aave')
	await press(radio('Entity type', 'Protocols'), 'ArrowRight')
	expect(document.activeElement).toBe(radio('Entity type', 'Chains'))
	expect(document.querySelector<HTMLInputElement>('[aria-label="Search chains"]')!.value).toBe('')
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
	expect(insert().disabled).toBe(true)
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
	await click(document.querySelector<HTMLButtonElement>('[aria-label="Remove annotation"]')!)
	expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
	await input(surviving, '')
	expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
	await input(surviving, 'Retained')
	expect(document.querySelector('[aria-label="Annotation 1 label"]')).toBe(surviving)
	await click(insert())
	expect(onInsert.mock.calls[0][0].annotations).toEqual([{ date: '2026-01-01T00:00:00.000Z', label: 'Retained' }])
})
