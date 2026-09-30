// @vitest-environment happy-dom
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { searchTableFeatures } from '../features/search'
import { VirtualTable } from '../VirtualTable'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pairs' }) }))

const features = searchTableFeatures
const helper = createColumnHelper<typeof features, { name: string }>()
const columns = helper.columns([helper.accessor('name', { header: 'Name', meta: { headerClassName: 'w-[180px]' } })])
const data = Array.from({ length: 100 }, (_, i) => ({ name: `Asset ${i + 1}` }))

function Fixture() {
	// Hidden columns can come back from a saved view, so the table can mount with none visible.
	const table = useTable({ features, columns, data, initialState: { columnVisibility: { name: false } } })
	return (
		<>
			<button type="button" onClick={() => table.getColumn('name')!.toggleVisibility(true)}>
				Show name
			</button>
			<VirtualTable table={table} useStickyHeader={false} />
		</>
	)
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// happy-dom lays nothing out, so the table sits at the top of the viewport after the page scrolled 1000px:
	// its document offset is 1000 and its first rows are the ones in view.
	vi.stubGlobal('scrollY', 1000)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	vi.unstubAllGlobals()
	container.remove()
})

test('a table that mounted with every column hidden renders the rows in view once a column is shown', async () => {
	await act(async () => root.render(<Fixture />))
	expect(container.textContent).toContain('No columns selected')
	await act(async () => container.querySelector('button')!.click())
	expect(container.querySelector('tbody tr:not([aria-hidden])')!.textContent).toBe('Asset 1')
})
