// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChartRuntimeView } from '../../../chartRuntime'
import { UnifiedChartTab } from '../UnifiedChartTab'

vi.mock('../../../AppMetadataContext', () => ({
	useAppMetadata: () => ({
		loading: false,
		availableChainChartTypes: () => ['tvl', 'fees'],
		availableProtocolChartTypes: () => ['tvl', 'fees']
	})
}))
vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({
		protocols: [],
		chains: [
			{ name: 'Ethereum', gecko_id: 'ethereum' },
			{ name: 'Solana', gecko_id: 'solana' }
		],
		getProtocolInfo: () => null
	}),
	useProDashboardVariables: () => ({ variables: [] })
}))
vi.mock('../CombinedChartPreview', () => ({ CombinedChartPreview: () => <p>combined chart</p> }))
vi.mock('../SeparateChartsPreview', () => ({ SeparateChartsPreview: () => <p>separate charts</p> }))

const runtime = { data: [], isLoading: false, hasError: false, canRetry: false, refetch: () => {} }
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

function renderForm(overrides: {
	composerItems: Array<ChartRuntimeView>
	chartCreationMode: 'separate' | 'combined'
	manualFormOpen?: boolean
	isEditingItem?: boolean
}) {
	return act(async () =>
		root.render(
			<UnifiedChartTab
				selectedChartTab="chain"
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
				onRemoveFromComposer={vi.fn()}
			/>
		)
	)
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
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
