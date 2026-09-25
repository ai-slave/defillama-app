import { expect, test } from 'vitest'
import { createWizardState } from './useUnifiedTableWizard'

test('an edited table hydrates canonical row headers and keeps its saved sorting and chains', () => {
	const state = createWizardState(undefined, {
		id: 'persisted',
		kind: 'unified-table',
		configVersion: 3,
		strategy: 'protocols',
		rowHeaders: ['protocol', 'chain', 'chain', 'parent-protocol'],
		defaultSorting: [{ id: 'fees24h', desc: false }],
		params: { chains: ['Ethereum'] }
	})

	expect(state.rowHeaders).toEqual(['chain', 'parent-protocol', 'protocol'])
	expect(state.sorting).toEqual([{ id: 'fees24h', desc: false }])
	expect(state.chains).toEqual(['Ethereum'])
})
