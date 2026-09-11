// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { DataTable } from '../dashboards/kpk/ui'
import { SimpleTable } from '../dashboards/odyssey-ecosystem/ui'
import { MiniTable } from '../dashboards/uniswap/ui'

type Row = { id: string; label: string }
const cols = [
	{ key: 'label', label: 'Label', render: (row: Row) => <input aria-label={row.id} defaultValue={row.label} /> }
]

for (const [name, Table] of [
	['KPK', DataTable],
	['Odyssey', SimpleTable]
] as const) {
	test(`${name} keeps edited input state with record IDs through rename and reorder`, async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		const container = document.createElement('div')
		const root = createRoot(container)
		const rows = [
			{ id: 'one', label: 'Same' },
			{ id: 'two', label: 'Same' }
		]
		try {
			await act(async () => root.render(<Table rows={rows} cols={cols} getRowKey={(row) => row.id} />))
			const first = container.querySelector<HTMLInputElement>('[aria-label="one"]')!
			first.value = 'User edit'
			await act(async () =>
				root.render(
					<Table rows={[rows[1], { ...rows[0], label: 'Renamed' }]} cols={cols} getRowKey={(row) => row.id} />
				)
			)
			expect(container.querySelector('[aria-label="one"]')).toBe(first)
			expect(first.value).toBe('User edit')
			expect(Array.from(container.querySelectorAll('input'), (input) => input.getAttribute('aria-label'))).toEqual([
				'two',
				'one'
			])
		} finally {
			await act(async () => root.unmount())
		}
	})
	test(`${name} preserves both anonymous occurrences when fallback is explicit`, async () => {
		const container = document.createElement('div')
		const root = createRoot(container)
		try {
			await act(async () =>
				root.render(
					<Table
						rows={[
							{ id: 'one', label: 'Same' },
							{ id: 'two', label: 'Same' }
						]}
						cols={cols}
						getOccurrenceKey={(row) => row.label}
					/>
				)
			)
			expect(container.querySelectorAll('input')).toHaveLength(2)
		} finally {
			await act(async () => root.unmount())
		}
	})
}

test('MiniTable keeps ID-keyed cells through rename and reorder', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	const root = createRoot(container)
	const render = (rows: Array<Array<string | number>>) =>
		root.render(
			<MiniTable
				grid="1fr 1fr"
				headers={[
					['ID', 'left'],
					['Label', 'left']
				]}
				rows={rows}
				getRowKey={(row) => String(row[0])}
			/>
		)
	try {
		await act(async () =>
			render([
				['one', 'Same'],
				['two', 'Same']
			])
		)
		const first = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'one')!
		await act(async () =>
			render([
				['two', 'Same'],
				['one', 'Renamed']
			])
		)
		expect(Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'one')).toBe(first)
		expect(container.textContent).toContain('Renamed')
	} finally {
		await act(async () => root.unmount())
	}
})
