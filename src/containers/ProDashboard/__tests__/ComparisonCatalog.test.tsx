// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { CONFIG_API, SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AppMetadataProvider } from '../AppMetadataContext'
import {
	ComparisonWizardProvider,
	useComparisonWizardContext
} from '../components/ComparisonWizard/ComparisonWizardContext'
import { SelectItemsStep } from '../components/ComparisonWizard/steps/SelectItemsStep'
import { ProDashboardAPIProvider, useProDashboardUI } from '../ProDashboardAPIContext'

const router = vi.hoisted(() => ({
	push: vi.fn(),
	replace: vi.fn(),
	pathname: '/pro/[dashboardId]',
	asPath: '/pro/x',
	query: {}
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

const http = installFixtureFetch()

let root: Root
let container: HTMLDivElement
let client: QueryClient

const CHAINS_URL = `${SERVER_URL}/chains`
const chainListReads = () => http.urls().filter((url) => url === CHAINS_URL).length

beforeEach(() => {
	vi.clearAllMocks()
	http.serve({
		[CHAINS_URL]: [
			{ name: 'Base', tvl: 100 },
			{ name: 'Ethereum', tvl: 200 }
		],
		[`${SERVER_URL}/chains2`]: { categories: [] },
		[`${SERVER_URL}/lite/protocols2`]: { protocols: [], parentProtocols: [] },
		// Metric availability reads app metadata once items are selectable.
		[`${CONFIG_API}/smol/appMetadata-chains.json`]: {},
		[`${CONFIG_API}/smol/appMetadata-protocols.json`]: {},
		'/api/public/pro-dashboard/pf-ps-protocols': { pf: [], ps: [] },
		'/api/dynamic/pro-dashboard/protocol-catalog-source': [{ slug: 'aave', parentSlug: 'aave', name: 'Aave', tvl: 100 }]
	})
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

function Harness() {
	const { createDashboardDialogStore } = useProDashboardUI()
	const { state, actions } = useComparisonWizardContext()
	return (
		<>
			<button type="button" onClick={() => createDashboardDialogStore.show()}>
				Create comparison
			</button>
			<button type="button" onClick={() => actions.setComparisonType('chains')}>
				Compare chains
			</button>
			<button type="button" onClick={() => actions.setComparisonType('protocols')}>
				Compare protocols
			</button>
			{state.comparisonType ? <SelectItemsStep /> : null}
		</>
	)
}

async function mount() {
	await act(async () => {
		root.render(
			<QueryClientProvider client={client}>
				<AuthProvider>
					<ProDashboardAPIProvider>
						<AppMetadataProvider>
							<ComparisonWizardProvider comparisonPreset={undefined}>
								<Harness />
							</ComparisonWizardProvider>
						</AppMetadataProvider>
					</ProDashboardAPIProvider>
				</AuthProvider>
			</QueryClientProvider>
		)
	})
}

async function click(label: string) {
	const button = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)
	expect(button, `button ${label}`).toBeDefined()
	await act(async () => button!.click())
}

async function waitForText(text: string) {
	await waitForUi(async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		expect(container.textContent).toContain(text)
	})
}

test.each(['chains', 'protocols'] as const)(
	'opening creation loads selectable %s from a cold view-mode catalog',
	async (type) => {
		await mount()
		await click(type === 'chains' ? 'Compare chains' : 'Compare protocols')
		expect(chainListReads()).toBe(0)
		await click('Create comparison')
		const label = type === 'chains' ? 'Base' : 'Aave'
		await waitForText(label)
		expect(chainListReads()).toBe(1)
		const search = container.querySelector<HTMLInputElement>('input[type="text"]')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, label)
			search.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await click(label)
		expect(container.querySelector(`[aria-label="${label}"]`)?.getAttribute('aria-checked')).toBe('true')
		expect(container.textContent).toContain('Selected (1/10)')
	}
)

test('a catalog failure shows an error and Try again recovers the chain list', async () => {
	let chainReads = 0
	http.serve({
		[CHAINS_URL]: () => (++chainReads === 1 ? fixtureStatus(404)() : [{ name: 'Base', tvl: 100 }])
	})
	await mount()
	await click('Compare chains')
	await click('Create comparison')
	await waitForText('Couldn’t load chains')
	expect(container.textContent).not.toContain('No chains found')
	await click('Try again')
	await waitForText('Base')
	expect(container.querySelector('[role="alert"]')).toBeNull()
	expect(chainListReads()).toBe(2)
})
