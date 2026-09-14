// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { DashboardVariable } from '../dashboardTypes'
import type { ParameterCandidate } from '../dashboardVariables/resolve'
import { DashboardVariablesBar } from './DashboardVariablesBar'
import { ParameterHint } from './ParameterHint'

const mocks = vi.hoisted(() => ({
	variables: [] as Array<DashboardVariable>,
	values: {} as Record<string, string>,
	candidates: [] as Array<ParameterCandidate>,
	items: [] as Array<DashboardItemConfig>,
	canEditVariables: false,
	setVariableValue: vi.fn(),
	addVariable: vi.fn(),
	renameVariable: vi.fn(),
	removeVariable: vi.fn(),
	unbindVariable: vi.fn()
}))

vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardVariables: () => ({
		variables: mocks.variables,
		values: mocks.values,
		candidates: mocks.candidates,
		canEditVariables: mocks.canEditVariables,
		setVariableValue: mocks.setVariableValue,
		addVariable: mocks.addVariable,
		renameVariable: mocks.renameVariable,
		removeVariable: mocks.removeVariable,
		unbindVariable: mocks.unbindVariable
	}),
	useProDashboardItemsState: () => ({ items: mocks.items }),
	useProDashboardCatalog: () => ({
		chains: [{ name: 'Ethereum' }, { name: 'Solana' }],
		protocols: [],
		protocolsLoading: false,
		protocolBySlug: new Map()
	})
}))

vi.mock('@tanstack/react-virtual', () => ({
	useVirtualizer: ({ count }: { count: number }) => ({
		getVirtualItems: () =>
			Array.from({ length: count }, (_, index) => ({
				index,
				key: index,
				start: index * 44,
				end: (index + 1) * 44,
				size: 44,
				lane: 0
			})),
		getTotalSize: () => count * 44,
		measure: () => {},
		scrollToIndex: () => {}
	})
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.variables = []
	mocks.values = {}
	mocks.candidates = []
	mocks.items = []
	mocks.canEditVariables = false
	mocks.setVariableValue.mockClear()
	mocks.addVariable.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function buttons(label: string) {
	return Array.from(document.body.querySelectorAll('button')).filter((node) => node.textContent?.trim() === label)
}

async function pickChain(label: string) {
	await act(async () => container.querySelector('button')!.click())
	await act(async () => buttons(label).at(-1)!.click())
}

const chainVariable: DashboardVariable = {
	id: 'chain',
	kind: 'chain',
	label: 'Chain',
	value: 'Ethereum'
}

test('an owner editing the dashboard saves the picked value as the default', async () => {
	mocks.variables = [chainVariable]
	mocks.canEditVariables = true
	await act(async () => root.render(<DashboardVariablesBar />))
	await pickChain('Solana')
	expect(mocks.setVariableValue).toHaveBeenCalledExactlyOnceWith('chain', 'Solana', { persist: true })
})

test('a viewer picking a value only overrides it for their own visit', async () => {
	mocks.variables = [chainVariable]
	await act(async () => root.render(<DashboardVariablesBar />))
	await pickChain('Solana')
	expect(mocks.setVariableValue).toHaveBeenCalledExactlyOnceWith('chain', 'Solana')
})

test('the bar stays out of a viewer without parameters and offers no editing menu', async () => {
	await act(async () => root.render(<DashboardVariablesBar />))
	expect(container.textContent).toBe('')
	mocks.variables = [chainVariable]
	await act(async () => root.render(<DashboardVariablesBar />))
	expect(buttons('Parameter')).toHaveLength(0)
	expect(container.querySelector('[aria-label="Parameter options for Chain"]')).toBeNull()
})

test('adding a parameter stops at the documented cap', async () => {
	mocks.canEditVariables = true
	mocks.variables = [chainVariable, { id: 'chain-2', kind: 'chain', label: 'Chain 2', value: 'Solana' }]
	await act(async () => root.render(<DashboardVariablesBar />))
	expect(buttons('Parameter')).toHaveLength(1)
	expect(container.querySelector('[aria-label="Parameter options for Chain"]')).not.toBeNull()
	mocks.variables = [
		chainVariable,
		{ id: 'chain-2', kind: 'chain', label: 'Chain 2', value: 'Solana' },
		{ id: 'chain-3', kind: 'chain', label: 'Chain 3', value: 'Ethereum' },
		{ id: 'chain-4', kind: 'chain', label: 'Chain 4', value: 'Solana' }
	]
	await act(async () => root.render(<DashboardVariablesBar />))
	expect(buttons('Parameter')).toHaveLength(0)
})

test('the hint turns a value two cards share into a bound parameter', async () => {
	mocks.canEditVariables = true
	mocks.candidates = [{ kind: 'chain', value: 'Ethereum', count: 2 }]
	mocks.items = [
		{ id: 'a', kind: 'stablecoins', chain: 'Ethereum' },
		{ id: 'b', kind: 'stablecoins', chain: 'Ethereum' }
	] as unknown as Array<DashboardItemConfig>
	await act(async () => root.render(<ParameterHint />))
	const hint = buttons('Make Ethereum a parameter')
	expect(hint).toHaveLength(1)
	await act(async () => hint[0]!.click())
	expect(mocks.addVariable).toHaveBeenCalledExactlyOnceWith(
		{ id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' },
		[
			{ itemId: 'a', field: 'chain' },
			{ itemId: 'b', field: 'chain' }
		]
	)
})

test('the hint keeps quiet once the dashboard already has a parameter', async () => {
	mocks.canEditVariables = true
	mocks.candidates = [{ kind: 'chain', value: 'Ethereum', count: 2 }]
	mocks.variables = [chainVariable]
	await act(async () => root.render(<ParameterHint />))
	expect(container.textContent).toBe('')
})

test('a viewer chip explains how many cards the parameter switches', async () => {
	mocks.variables = [chainVariable]
	mocks.items = [
		{ id: 'a', kind: 'stablecoins', chain: 'Ethereum', bindings: { chain: 'chain' } },
		{ id: 'b', kind: 'stablecoins', chain: 'Ethereum', bindings: { chain: 'chain' } },
		{ id: 'c', kind: 'stablecoins', chain: 'Solana' }
	] as unknown as Array<DashboardItemConfig>
	await act(async () => root.render(<DashboardVariablesBar />))
	await act(async () => {
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
		container.querySelector<HTMLElement>('span[tabindex="0"]')!.focus()
	})
	expect(document.body.textContent).toContain('Switches 2 bound cards')
})
