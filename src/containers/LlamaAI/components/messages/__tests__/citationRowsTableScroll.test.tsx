// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CitationRowsTable } from '../ToolDataView'

let host: HTMLDivElement
let root: Root

// happy-dom has no layout: the cited cell sits 900px in, 100px wide, inside a 400px-wide scroller.
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
		return this.tagName === 'TD' ? 900 : 0
	})
	vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return this.tagName === 'TD' ? 100 : 0
	})
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return this.hasAttribute('data-cited-scroller') ? 400 : 0
	})
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
})

afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	vi.restoreAllMocks()
})

test('centers the cited cell when the rows arrive after the table mounts', async () => {
	const citedCell = { rowIndex: 0, column: 'tvl' }
	await act(async () =>
		root.render(<CitationRowsTable rows={undefined} columns={['name', 'tvl']} citedCell={citedCell} />)
	)
	await act(async () =>
		root.render(
			<CitationRowsTable rows={[{ name: 'Aave', tvl: 10 }]} columns={['name', 'tvl']} citedCell={citedCell} />
		)
	)

	expect(host.firstElementChild!.scrollLeft).toBe(750)
})
