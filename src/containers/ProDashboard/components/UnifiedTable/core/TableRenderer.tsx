'use no memo'

import type { Table } from '@tanstack/react-table'
import * as React from 'react'
import { LoadingSpinner } from '../../LoadingSpinner'
import type { NormalizedRow } from '../types'
import { UnifiedVirtualTable } from './UnifiedVirtualTable'

interface TableRendererProps {
	table: Table<NormalizedRow>
	isLoading: boolean
	isEmpty?: boolean
	emptyMessage?: string
	rowStateVersion?: string
}

export const TableRenderer = React.memo(function TableRenderer({
	table,
	isLoading,
	isEmpty = false,
	emptyMessage = 'No rows match the current filters.',
	rowStateVersion
}: TableRendererProps) {
	if (isLoading) {
		return (
			<div className="relative isolate h-[450px] overflow-hidden rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg)">
				<div className="flex h-full items-center justify-center">
					<LoadingSpinner />
				</div>
			</div>
		)
	}

	return (
		<div className="relative isolate flex h-[450px] flex-col overflow-hidden rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg)">
			<UnifiedVirtualTable table={table} rowStateVersion={rowStateVersion} />
			{isEmpty ? (
				<div className="pointer-events-none absolute inset-0 z-5 flex items-center justify-center bg-linear-to-b from-transparent via-(--legacy-cards-bg)/90 to-(--legacy-cards-bg)">
					<div className="pointer-events-auto rounded-md border border-(--legacy-cards-border) bg-(--legacy-cards-bg) px-4 py-3 text-sm text-(--legacy-text-secondary)">
						{emptyMessage}
					</div>
				</div>
			) : null}
		</div>
	)
})
