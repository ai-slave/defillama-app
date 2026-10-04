import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { AppMetadataProvider } from '../../../AppMetadataContext'
import type { ChartRuntimeView } from '../../../chartRuntime'
import type { Chain } from '../../../types'
import { UnifiedChartTab } from '../UnifiedChartTab'

const chains: Array<Chain> = [
	{ name: 'Ethereum', gecko_id: 'ethereum', tvl: 2, tokenSymbol: 'ETH', chainId: 1, cmcId: null },
	{ name: 'Solana', gecko_id: 'solana', tvl: 1, tokenSymbol: 'SOL', chainId: null, cmcId: null }
]

const http = installFixtureFetch()
// The previews draw charts from fetched series; these tests only read which preview the form shows.
vi.mock('../CombinedChartPreview', () => ({ CombinedChartPreview: () => <p>combined chart</p> }))
vi.mock('../SeparateChartsPreview', () => ({ SeparateChartsPreview: () => <p>separate charts</p> }))

const runtime = { data: [], isLoading: false, hasError: false, canRetry: false, isFetching: false, refetch: () => {} }
const ethereumTvl: ChartRuntimeView = {
	id: 'ethereum-tvl',
	kind: 'chart',
	subjectType: 'chain',
	chain: 'Ethereum',
	type: 'tvl',
	...runtime
}
const solanaTvl: ChartRuntimeView = {
	id: 'solana-tvl',
	kind: 'chart',
	subjectType: 'chain',
	chain: 'Solana',
	type: 'tvl',
	...runtime
}

const onChartCreationModeChange = vi.fn()
const onRemoveFromComposer = vi.fn()

function renderForm(overrides: {
	composerItems: Array<ChartRuntimeView>
	chartCreationMode: 'separate' | 'combined'
	manualFormOpen?: boolean
	isEditingItem?: boolean
	selectedChartTab?: 'chain' | 'income-statement'
}) {
	return act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AppMetadataProvider>
					<DashboardTestProvider catalog={{ chains }}>
						<UnifiedChartTab
							selectedChartTab={overrides.selectedChartTab ?? 'chain'}
							selectedChartTypes={['tvl']}
							chainOptions={[
								{ value: 'Ethereum', label: 'Ethereum' },
								{ value: 'Solana', label: 'Solana' }
							]}
							protocolOptions={[]}
							protocolsLoading={false}
							unifiedChartName=""
							chartCreationMode={overrides.chartCreationMode}
							composerItems={overrides.composerItems}
							manualFormOpen={overrides.manualFormOpen ?? true}
							isEditingItem={overrides.isEditingItem ?? false}
							onSelectCategory={vi.fn()}
							onBackToCategories={vi.fn()}
							onChartTabChange={vi.fn()}
							onChartTypesChange={vi.fn()}
							onBulkChartTypeChange={vi.fn()}
							onUnifiedChartNameChange={vi.fn()}
							onChartCreationModeChange={onChartCreationModeChange}
							onComposerItemColorChange={vi.fn()}
							onAddToComposer={vi.fn()}
							onRemoveFromComposer={onRemoveFromComposer}
							// The category's own form is CategoryChartForm's; these tests read only what surrounds it.
							categoryForm={<p>category form</p>}
						/>
					</DashboardTestProvider>
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	)
}

let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	vi.clearAllMocks()
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	http.serve(
		appMetadataFixtures({
			chains: {
				ethereum: { name: 'Ethereum', id: 'ethereum', fees: true },
				solana: { name: 'Solana', id: 'solana', fees: true }
			}
		})
	)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('editing a chart opens the form with the subject selected', async () => {
	await renderForm({ composerItems: [ethereumTvl], chartCreationMode: 'separate', isEditingItem: true })
	expect(document.body.textContent).not.toContain('Yields')
	expect(document.body.textContent).toContain('1 selected')
	expect(document.body.textContent).toContain('Ethereum - TVL')
	expect(document.querySelector('[title="Back to categories"]')).toBeNull()
	expect(document.querySelector('[data-testid="combined-preview"]')).not.toBeNull()
})

test('the mode toggle appears with two selections and switches the preview', async () => {
	await renderForm({ composerItems: [ethereumTvl], chartCreationMode: 'combined' })
	expect(document.querySelector('input[type="radio"][value="separate"]')).toBeNull()

	await renderForm({ composerItems: [ethereumTvl, solanaTvl], chartCreationMode: 'combined' })
	expect(document.querySelector('[data-testid="combined-preview"]')).not.toBeNull()
	expect(document.querySelector('[data-testid="separate-preview"]')).toBeNull()

	const separateRadio = document.querySelector<HTMLInputElement>('input[type="radio"][value="separate"]')!
	await act(async () => {
		separateRadio.click()
	})
	expect(onChartCreationModeChange).toHaveBeenCalledWith('separate')

	await renderForm({ composerItems: [ethereumTvl, solanaTvl], chartCreationMode: 'separate' })
	expect(document.querySelector('[data-testid="separate-preview"]')).not.toBeNull()
	expect(document.querySelector('[data-testid="combined-preview"]')).toBeNull()
})

test('the category grid stays until a category is picked', async () => {
	await renderForm({ composerItems: [], chartCreationMode: 'combined', manualFormOpen: false })
	expect(document.querySelector('[data-testid="combined-preview"]')).toBeNull()
	expect(document.body.textContent).toContain('Yields')
})

test('Clear removes the picked chart type only from the subject being listed', async () => {
	const aaveTvl: ChartRuntimeView = {
		id: 'aave-tvl',
		kind: 'chart',
		subjectType: 'protocol',
		protocol: 'aave',
		type: 'tvl',
		...runtime
	}
	await renderForm({ composerItems: [ethereumTvl, aaveTvl, solanaTvl], chartCreationMode: 'combined' })

	const clear = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Clear')!
	await act(async () => {
		clear.click()
	})

	expect(onRemoveFromComposer.mock.calls).toEqual([['ethereum-tvl'], ['solana-tvl']])
})

test('a single-card category shows no series composer for series it would not save', async () => {
	await renderForm({
		composerItems: [ethereumTvl, solanaTvl],
		chartCreationMode: 'combined',
		selectedChartTab: 'income-statement'
	})
	expect(document.body.textContent).not.toContain('Combine into one chart')
	expect(document.body.textContent).not.toContain('Ethereum - TVL')
})
