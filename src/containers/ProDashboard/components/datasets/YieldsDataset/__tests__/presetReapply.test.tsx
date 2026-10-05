// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { useYieldsTable } from '../useYieldsTable'

type Table = ReturnType<typeof useYieldsTable>

// The preset picker is a radio, which ignores a click on the checked option. A reorder must uncheck the preset, or
// picking it again could never restore its column order.
test('moving a column unchecks the preset, and picking the preset again restores its order', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	let table!: Table
	function Harness() {
		table = useYieldsTable({
			data: [],
			initialColumnOrder: undefined,
			initialColumnVisibility: undefined,
			initialFilters: undefined,
			onColumnsChange: () => {},
			onFiltersChange: () => {}
		})
		return null
	}
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () => root.render(<Harness />))

	expect(table.activePreset).toBe('essential')
	const presetOrder = [...table.columnOrder]

	await act(async () => table.moveColumnDown(presetOrder[0]!))
	expect(table.activePreset).toBe(null)
	expect(table.columnOrder).not.toEqual(presetOrder)

	await act(async () => table.applyPreset('essential'))
	expect(table.activePreset).toBe('essential')
	expect(table.columnOrder).toEqual(presetOrder)

	await act(async () => root.unmount())
})
