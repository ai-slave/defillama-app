import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { UnifiedTableConfig } from '~/containers/ProDashboard/unifiedTable/config/current'
import { useUnifiedTableWizard } from './useUnifiedTableWizard'

let captured: ReturnType<typeof useUnifiedTableWizard> | null = null

function Probe({ config }: { config?: UnifiedTableConfig }) {
	captured = useUnifiedTableWizard(undefined, config)
	return null
}

describe('useUnifiedTableWizard normalization', () => {
	test('hydrates persisted edit state and draft config with the same canonical headers and sorting', () => {
		const sorting = [{ id: 'fees24h', desc: false }]
		const config: UnifiedTableConfig = {
			id: 'persisted',
			kind: 'unified-table',
			configVersion: 3,
			strategy: 'protocols',
			rowHeaders: ['protocol', 'chain', 'chain', 'parent-protocol'],
			defaultSorting: sorting,
			params: { chains: ['All'] }
		}

		renderToStaticMarkup(<Probe config={config} />)

		expect(captured?.state.rowHeaders).toEqual(['chain', 'parent-protocol', 'protocol'])
		expect(captured?.derived.draftConfig.rowHeaders).toBe(captured?.state.rowHeaders)
		expect(captured?.state.sorting).toEqual(sorting)
		expect(captured?.derived.draftConfig.defaultSorting).toBe(captured?.state.sorting)
	})

	test('creates preview state with canonical preset headers', () => {
		renderToStaticMarkup(<Probe />)

		expect(captured?.state.rowHeaders.at(-1)).toBe('protocol')
		expect(captured?.derived.draftConfig.rowHeaders).toBe(captured?.state.rowHeaders)
	})
})
