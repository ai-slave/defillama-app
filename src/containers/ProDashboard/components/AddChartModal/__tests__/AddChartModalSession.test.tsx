// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('~/containers/Subscription/shared/SubscriptionLoadError', () => ({ SubscriptionLoadError: () => null }))
vi.mock('../../../hooks/useIsSqlAllowed', () => ({
	useIsSqlAllowed: () => ({ isAllowed: true, isUnknown: false, isRetrying: false, retry: () => {} })
}))
vi.mock('../../SqlChart/SqlChartUpsell', () => ({ SqlChartUpsell: () => null }))
vi.mock('../bindingContext', () => ({
	ModalBindingsProvider: ({ children }: { children: React.ReactNode }) => children
}))
vi.mock('../ChartTab', () => ({ ChartTab: () => null }))
vi.mock('../CustomDataTab', () => ({ CustomDataTab: () => null }))
vi.mock('../LlamaAITab', () => ({ LlamaAITab: () => null }))
vi.mock('../MetricTab', () => ({ MetricTab: () => null }))
vi.mock('../ModalHeader', () => ({ ModalHeader: () => null }))
vi.mock('../SqlHandoffPanel', () => ({ SqlHandoffPanel: () => null }))
vi.mock('../SubmitButton', () => ({ SubmitButton: () => null }))
vi.mock('../TabNavigation', () => ({ MAIN_TAB_VALUES: ['text'] as const, TabNavigation: () => null }))
vi.mock('../TextTab', () => ({ TextTab: () => <p>Text card</p> }))
vi.mock('../UnifiedTableTab', () => ({ UnifiedTableTab: () => null }))
vi.mock('../useComposerItemsData', () => ({ useComposerItemsData: () => [] }))
vi.mock('../useModalActions', () => ({
	useModalActions: () => ({ state: { selectedMainTab: 'text', bindings: {} }, actions: {}, computed: {} })
}))

import { AddChartModal } from '../AddChartModal'

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

function sheet() {
	return document.body.querySelector('.add-chart-dialog')
}

test('the sheet reports it has finished leaving so its session can be dropped', async () => {
	const onClose = vi.fn()
	const onClosed = vi.fn()
	await act(async () => root.render(<AddChartModal isOpen onClose={onClose} onClosed={onClosed} editItem={null} />))
	expect(sheet()).not.toBeNull()
	expect(onClosed).not.toHaveBeenCalled()

	await act(async () =>
		root.render(<AddChartModal isOpen={false} onClose={onClose} onClosed={onClosed} editItem={null} />)
	)
	expect(sheet()).toBeNull()
	expect(onClosed).toHaveBeenCalledOnce()
})

test('a sheet that never opened never reports a close', async () => {
	const onClosed = vi.fn()
	await act(async () =>
		root.render(<AddChartModal isOpen={false} onClose={() => {}} onClosed={onClosed} editItem={null} />)
	)
	expect(onClosed).not.toHaveBeenCalled()
})
