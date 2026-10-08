// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { ProDashboardAPIProvider, useProDashboardUI } from '../../ProDashboardAPIContext'
import { CreateDashboardPicker } from '../CreateDashboardPicker'

const api = vi.hoisted(() => ({
	catalog: vi.fn(),
	category: vi.fn(),
	dimension: vi.fn(),
	create: vi.fn(),
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => ({ push: api.push, query: {} }) }))
// fetchJson is the network boundary: route each upstream the templates read to its own fixture.
vi.mock('~/utils/async', async (original) => ({
	...(await original<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const { pathname } = new URL(url, 'http://localhost')
		if (pathname.endsWith('protocol-catalog-source')) return api.catalog()
		if (pathname.startsWith('/chains2/')) return api.category(decodeURIComponent(pathname.slice('/chains2/'.length)))
		if (pathname === '/chains')
			return [
				{ name: 'Base', tvl: 300 },
				{ name: 'Ethereum', tvl: 200 }
			]
		if (pathname === '/lite/protocols2') return { protocols: [], parentProtocols: [] }
		return api.dimension(url)
	}
}))

const catalog = [
	{ slug: 'aave', parentSlug: 'aave', name: 'Aave', tvl: 100, category: 'Lending' },
	{ slug: 'spark', parentSlug: 'spark', name: 'Spark', tvl: 50, category: 'Lending' },
	{ slug: 'dex-by-tvl', parentSlug: 'dex-by-tvl', name: 'DEX by TVL', tvl: 500, category: 'Dexes' }
]
const session = installSubscriberSession('owner', { resolved: true })
let root: Root
let container: HTMLDivElement
function Harness() {
	const { createDashboardDialogStore } = useProDashboardUI()
	return (
		<>
			<button type="button" onClick={() => createDashboardDialogStore.show()}>
				Create new dashboard
			</button>
			<CreateDashboardPicker dialogStore={createDashboardDialogStore} onCreate={api.create} />
		</>
	)
}
async function mount() {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ProDashboardAPIProvider mode="view">
					<Harness />
				</ProDashboardAPIProvider>
			</session.Wrapper>
		)
	)
}
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim().startsWith(name)
	)!
}
async function click(name: string) {
	await act(async () => button(name).click())
}
async function ready(name: string) {
	await act(async () => {
		await waitForUi(() => {
			expect(button(name).getAttribute('aria-label')).toBe(name)
			expect(button(name).getAttribute('aria-disabled')).not.toBe('true')
		})
	})
}
function savedFilters() {
	return api.create.mock.calls.at(-1)![0].items.find((item: { kind: string }) => item.kind === 'unified-table').filters
}
beforeEach(() => {
	vi.clearAllMocks()
	api.push.mockReset().mockResolvedValue(true)
	api.catalog.mockReset().mockResolvedValue(catalog)
	api.category.mockReset().mockResolvedValue({ chainsUnique: ['Base'] })
	api.dimension.mockReset().mockResolvedValue({ protocols: [{ slug: 'volume-leader', name: 'Volume Leader' }] })
	api.create.mockReset().mockResolvedValue({ id: 'created', slug: 'template-created' })
	// Template sources retry on their own; a zero delay keeps a failing source from stalling the test.
	session.client.setDefaultOptions({ queries: { retry: false, retryDelay: 0 } })
	// The signed-in owner has no dashboards yet.
	session.serve({ '/dashboards': { items: [] }, '/lite/dashboards': { items: [] } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('cold catalog blocks Lending while From Scratch remains immediately usable', async () => {
	const response = Promise.withResolvers<typeof catalog>()
	api.catalog.mockReturnValue(response.promise)
	await mount()
	expect(api.catalog).not.toHaveBeenCalled()
	expect(api.dimension).not.toHaveBeenCalled()
	expect(api.category).not.toHaveBeenCalled()
	await click('Create new dashboard')
	await click('Lending protocols')
	expect(api.create).not.toHaveBeenCalled()
	expect(button('Lending protocols').getAttribute('aria-disabled')).toBe('true')
	await click('From scratch')
	const name = document.querySelector<HTMLInputElement>('[name="dashboardName"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Blank by choice')
		name.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await click('Create dashboard')
	expect(api.create).toHaveBeenCalledExactlyOnceWith({
		dashboardName: 'Blank by choice',
		visibility: 'private',
		tags: [],
		description: ''
	})
	await click('Create new dashboard')
	await act(async () => response.resolve(catalog))
	await ready('Lending protocols')
	await click('Lending protocols')
	expect(savedFilters()).toEqual({ protocols: ['aave', 'spark'] })
})

test.each([
	['Top L1 chains', ['Ethereum']],
	['L2 ecosystem', ['Base']]
] as const)('%s waits for category membership before selecting chains', async (name, chains) => {
	const response = Promise.withResolvers<{ chainsUnique: Array<string> }>()
	api.category.mockReturnValue(response.promise)
	await mount()
	await click('Create new dashboard')
	await ready('Lending protocols')
	await click(name)
	expect(api.create).not.toHaveBeenCalled()
	await act(async () => response.resolve({ chainsUnique: ['Base'] }))
	await ready(name)
	await click(name)
	expect(savedFilters()).toEqual({ chains })
})

test.each([
	['DEX leaders', 'dexs'],
	['Perps protocols', 'perps'],
	['DEX Aggregators', 'dex-aggregators']
])('%s waits for its dimension and can load independently of the catalog', async (name, endpoint) => {
	const response = Promise.withResolvers<{ protocols: Array<{ slug: string; name: string }> }>()
	api.catalog.mockReturnValue(new Promise(() => {}))
	api.dimension.mockImplementation((url: string) =>
		url.endsWith(`/${endpoint}`)
			? response.promise
			: Promise.resolve({ protocols: [{ slug: 'other-dimension', name: 'Other dimension' }] })
	)
	await mount()
	await click('Create new dashboard')
	await click(name)
	expect(api.create).not.toHaveBeenCalled()
	await act(async () => response.resolve({ protocols: [{ slug: 'volume-leader', name: 'Volume Leader' }] }))
	await ready(name)
	await click(name)
	expect(savedFilters()).toEqual({ protocols: ['volume-leader'] })
})

test.each(['catalog', 'category', 'dimension'] as const)(
	'%s failure shows one retry for the templates, keeps it while the retry runs, and creates nothing partial',
	async (source) => {
		api[source].mockRejectedValue(new Error('Unavailable'))
		await mount()
		await click('Create new dashboard')
		const name = source === 'catalog' ? 'Lending protocols' : source === 'category' ? 'L2 ecosystem' : 'DEX leaders'
		await act(async () => {
			await waitForUi(() =>
				expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load template data.')
			)
		})
		expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
		expect(button(name).getAttribute('aria-disabled')).toBe('true')
		await click(name)
		expect(api.create).not.toHaveBeenCalled()
		const response = Promise.withResolvers<unknown>()
		api[source].mockReturnValue(response.promise)
		const retry = button('Try again')
		await act(async () => {
			retry.focus()
			retry.click()
		})
		// The notice stays while the retry runs, with its Try again waiting and focused.
		await act(async () => {
			await waitForUi(() => expect(accessibleName(retry)).toBe('Retrying…'))
		})
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load template data.')
		expect(document.activeElement).toBe(retry)
		await act(async () =>
			response.resolve(
				source === 'catalog'
					? catalog
					: source === 'category'
						? { chainsUnique: ['Base'] }
						: { protocols: [{ slug: 'volume-leader', name: 'Volume Leader' }] }
			)
		)
		await ready(name)
		expect(document.querySelector('[role="alert"]')).toBeNull()
		// The notice took its Try again with it, so the dialog hands focus to its first control instead of the page.
		expect(document.activeElement).toBe(button('Close dialog'))
		await click(name)
		expect(savedFilters()).toEqual(
			source === 'catalog'
				? { protocols: ['aave', 'spark'] }
				: source === 'category'
					? { chains: ['Base'] }
					: { protocols: ['volume-leader'] }
		)
	}
)

test('empty dimension data cannot fall back to unrelated TVL data or create an empty dashboard', async () => {
	api.dimension.mockResolvedValue({ protocols: [] })
	await mount()
	await click('Create new dashboard')
	await ready('Lending protocols')
	await act(async () => {
		await waitForUi(() => expect(button('DEX leaders').textContent).toContain('No matching data available.'))
	})
	await click('DEX leaders')
	expect(api.create).not.toHaveBeenCalled()
})

test('closing and reopening while data loads never submits automatically or navigates', async () => {
	const response = Promise.withResolvers<typeof catalog>()
	api.catalog.mockReturnValue(response.promise)
	await mount()
	await click('Create new dashboard')
	await click('Lending protocols')
	await click('Close dialog')
	await act(async () => response.resolve(catalog))
	expect(api.create).not.toHaveBeenCalled()
	expect(api.push).not.toHaveBeenCalled()
	await click('Create new dashboard')
	await ready('Lending protocols')
	await click('Lending protocols')
	expect(api.create).toHaveBeenCalledOnce()
	expect(savedFilters()).toEqual({ protocols: ['aave', 'spark'] })
})

test('pending template creation keeps focus and ignores duplicate activation, then retries the same selection', async () => {
	const completion = Promise.withResolvers<{ id: string }>()
	api.create.mockReturnValueOnce(completion.promise).mockResolvedValueOnce({ id: 'created' })
	await mount()
	await click('Create new dashboard')
	await ready('Lending protocols')
	const choice = button('Lending protocols')
	await act(async () => choice.focus())
	await click('Lending protocols')
	await act(async () => {
		await waitForUi(() => expect(choice.getAttribute('aria-disabled')).toBe('true'))
	})
	expect(document.activeElement).toBe(choice)
	expect(choice.querySelector('[role="status"]')?.textContent).toBe('Creating dashboard…')
	expect(button('Liquid Staking').getAttribute('aria-busy')).toBe('false')
	await click('Lending protocols')
	expect(api.create).toHaveBeenCalledOnce()
	await act(async () => completion.reject(new Error('Save unavailable')))
	await ready('Lending protocols')
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable')
	expect(document.activeElement).toBe(choice)
	await click('Lending protocols')
	expect(api.create).toHaveBeenCalledTimes(2)
	expect(savedFilters()).toEqual({ protocols: ['aave', 'spark'] })
})

test('replaces the templates with the created dashboard until navigation finishes', async () => {
	const navigation = Promise.withResolvers<boolean>()
	api.push.mockReturnValueOnce(navigation.promise)
	await mount()
	await click('Create new dashboard')
	await ready('Lending protocols')
	await click('Lending protocols')
	await act(async () => {
		await waitForUi(() =>
			expect(document.querySelector('a[href="/pro/template-created/edit"]')?.textContent).toBe('Open dashboard')
		)
	})
	expect(button('Lending protocols')).toBeUndefined()
	expect(api.create).toHaveBeenCalledOnce()
	await act(async () => navigation.resolve(true))
	await act(async () => {
		await waitForUi(() => expect(button('Lending protocols')).toBeUndefined())
	})
})
