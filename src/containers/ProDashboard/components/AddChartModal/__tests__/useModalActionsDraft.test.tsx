// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../../../dashboardItemConfig'
import type { ChartConfig } from '../../../types'
import { useModalActions } from '../useModalActions'

const mocks = vi.hoisted(() => ({
	appendItems: vi.fn((_createItems: (existing: Array<DashboardItemConfig>) => Array<DashboardItemConfig>) => [
		'added-item'
	]) as unknown as ReturnType<typeof vi.fn>,
	editItem: vi.fn(() => true),
	reveal: vi.fn()
}))

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock }))

vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ protocols: [], chains: [], protocolsLoading: false }),
	useProDashboardTime: () => ({ timePeriod: '365d', customTimePeriod: null }),
	useProDashboardEditorActions: () => ({ handleAppendItems: mocks.appendItems, handleEditItem: mocks.editItem })
}))

vi.mock('../../../hooks/useDashboardItemDeepLink', () => ({ requestDashboardItemReveal: mocks.reveal }))

const chartDraft = {
	id: 'quick-add-draft',
	kind: 'chart',
	subjectType: 'protocol',
	protocol: 'uniswap',
	type: 'fees',
	grouping: 'day',
	colSpan: 1
} satisfies ChartConfig

const onClose = vi.fn()

function Probe({ draftItem }: { draftItem: DashboardItemConfig }) {
	const { actions } = useModalActions(null, onClose, undefined, draftItem)
	return (
		<button type="button" onClick={() => actions.handleSubmit()}>
			Submit
		</button>
	)
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	mocks.appendItems.mockImplementation(() => ['added-item'])
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function submit(draftItem: DashboardItemConfig) {
	await act(async () => root.render(<Probe draftItem={draftItem} />))
	const trigger = document.body.querySelector('button')
	await act(async () => trigger?.click())
}

test('submitting a draft only session appends instead of editing', async () => {
	await submit(chartDraft)

	expect(mocks.editItem).not.toHaveBeenCalled()
	expect(mocks.appendItems).toHaveBeenCalledOnce()
	const createItems = mocks.appendItems.mock.calls[0]?.[0] as (
		existing: Array<DashboardItemConfig>
	) => Array<DashboardItemConfig>
	expect(createItems([])).toMatchObject([
		{ kind: 'chart', subjectType: 'protocol', protocol: 'uniswap', type: 'fees', grouping: 'day' }
	])
	expect(onClose).toHaveBeenCalledOnce()
	expect(mocks.reveal).toHaveBeenCalledExactlyOnceWith('added-item')
})

test('a draft only session that cannot append warns instead of closing', async () => {
	mocks.appendItems.mockImplementation(() => false)
	await submit(chartDraft)

	expect(toastMock.error).toHaveBeenCalledWith('The dashboard is still loading. Try again in a moment.', {
		id: 'dashboard-not-ready'
	})
	expect(onClose).not.toHaveBeenCalled()
	expect(mocks.editItem).not.toHaveBeenCalled()
})
