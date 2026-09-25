import { createColumnHelper } from '@tanstack/react-table'
import { expect, test } from 'vitest'
import { constructTestTable } from '../../__tests__/helpers/constructTestTable'
import { filteredTableFeatures } from '../filtering'

const helper = createColumnHelper<typeof filteredTableFeatures, { name: string; amount: number }>()
const columns = helper.columns([
	helper.accessor('name', { filterFn: 'includesString' }),
	helper.accessor('amount', { filterFn: 'inNumberRange' })
])

test('applies and clears the registered text and range filters', () => {
	const table = constructTestTable({
		features: filteredTableFeatures,
		columns,
		data: [
			{ name: 'Alpha', amount: 5 },
			{ name: 'Beta', amount: 10 },
			{ name: 'Gamma', amount: 20 }
		]
	})
	const visibleNames = () => table.getRowModel().rows.map((row) => row.original.name)

	table.getColumn('name')!.setFilterValue('ALP')
	expect(visibleNames()).toEqual(['Alpha'])
	table.getColumn('name')!.setFilterValue(undefined)
	table.getColumn('amount')!.setFilterValue([10, 20])
	expect(visibleNames()).toEqual(['Beta', 'Gamma'])
	table.getColumn('amount')!.setFilterValue(undefined)
	expect(visibleNames()).toEqual(['Alpha', 'Beta', 'Gamma'])
})
