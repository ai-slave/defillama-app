import { createColumnHelper } from '@tanstack/react-table'
import { expect, test } from 'vitest'
import { constructTestTable } from '../../__tests__/helpers/constructTestTable'
import { displayTableFeatures } from '../display'

const helper = createColumnHelper<typeof displayTableFeatures, { name: string; tvl: number; fees: number }>()
const columns = helper.columns([
	helper.accessor('name', { enableHiding: false }),
	helper.accessor('tvl', {}),
	helper.accessor('fees', {})
])

test('keeps the identity column visible when the stored visibility hides it', () => {
	const table = constructTestTable({
		features: displayTableFeatures,
		columns,
		data: [{ name: 'Ethereum', tvl: 1, fees: 2 }],
		initialState: { columnVisibility: { name: false, tvl: false, fees: true } }
	})

	expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual(['name', 'fees'])
	expect(
		table
			.getRowModel()
			.rows[0].getVisibleCells()
			.map((cell) => cell.getValue())
	).toEqual(['Ethereum', 2])
})
