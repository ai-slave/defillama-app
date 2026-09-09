import { tableFromArrays } from 'apache-arrow'
import { expect, test, vi } from 'vitest'
import { exportQueryResult } from '../exportResults'
import { normalizeSqlResultRows } from '../resultNormalization'

test('exports Arrow integers, lists, dates and text without losing precision or CSV boundaries', async () => {
	const table = tableFromArrays({
		id: new BigInt64Array([9_007_199_254_740_993n]),
		amounts: [[9_007_199_254_740_993n, -2n]],
		date: [new Date('2024-01-01T00:00:00Z')],
		note: ['Alpha, Inc.\r\n"quoted"'],
		active: [false]
	})
	const columns = table.schema.fields.map((field) => ({ name: field.name, type: String(field.type) }))
	const result = normalizeSqlResultRows({
		columns,
		rows: table.toArray().map((row) => columns.map((column) => row[column.name]))
	})
	let csvBlob: Blob | undefined
	const link = { href: '', download: '', style: {}, click: vi.fn() }
	vi.stubGlobal('window', {
		URL: {
			createObjectURL: (blob: Blob) => {
				csvBlob = blob
				return 'blob:sql'
			},
			revokeObjectURL: vi.fn()
		}
	})
	vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn(), removeChild: vi.fn() } })
	try {
		exportQueryResult(result, 'csv', 'sql-values')
		if (!csvBlob) throw new Error('No CSV Blob created')
		expect(await csvBlob.text()).toBe(
			'id,amounts,date,note,active\n9007199254740993,"[""9007199254740993"",""-2""]",2024-01-01T00:00:00.000Z,"Alpha, Inc.\r\n""quoted""",false'
		)
	} finally {
		vi.unstubAllGlobals()
	}
})
