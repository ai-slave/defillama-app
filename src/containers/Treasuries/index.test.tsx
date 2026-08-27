import type { ColumnDef } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Treasuries } from './index'
import type { ITreasuryRow } from './types'

vi.mock('~/components/Table/TableWithSearch', () => ({
	TableWithSearch: ({ columns }: { columns: ColumnDef<ITreasuryRow>[] }) => (
		<div>{columns.map((column) => column.id ?? ('accessorKey' in column ? column.accessorKey : '')).join(',')}</div>
	)
}))

describe('treasury table columns', () => {
	it('keeps protocol-only metrics out of entity treasuries after switching to accessor functions', () => {
		const entityHtml = renderToStaticMarkup(<Treasuries data={[]} entity />)
		const protocolHtml = renderToStaticMarkup(<Treasuries data={[]} entity={false} />)
		for (const id of ['ownTokens', 'coreTvl', 'mcap']) {
			expect(entityHtml).not.toContain(id)
			expect(protocolHtml).toContain(id)
		}
		expect(entityHtml).toContain('tvl')
	})
})
