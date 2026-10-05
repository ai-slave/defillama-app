import type { ParsedUrlQuery } from 'node:querystring'
import { useRouter } from 'next/router'
import * as React from 'react'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { Card } from '~/ui/Card'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TableToolbar } from '~/ui/Toolbar'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { buildCardsColumns, CARDS_COLUMN_GROUPS, type CardsColumnGroup, cardsColumnVisibility } from './cardsColumns'
import { cardsChainOptions, filterCards, resolveCardsFilterState } from './filterPolicy'
import { type CardsReferenceModel, type CardTableRow, type CardTierRow, groupCardRows } from './models'

export const CARDS_QUERY_KEYS = {
	columnGroup: 'view'
} as const

export const DEFAULT_CARDS_COLUMN_GROUP: CardsColumnGroup = 'overview'

// Every body row is pinned to this height so the window virtualizer's fixed row estimate holds
const CARDS_ROW_HEIGHT = 65

export function getCardsColumnGroup(query: ParsedUrlQuery): CardsColumnGroup {
	const value = readSingleQueryValue(query[CARDS_QUERY_KEYS.columnGroup])
	return CARDS_COLUMN_GROUPS.some((group) => group.value === value)
		? (value as CardsColumnGroup)
		: DEFAULT_CARDS_COLUMN_GROUP
}

export function CardsTable({ rows, reference }: { rows: Array<CardTierRow>; reference: CardsReferenceModel }) {
	const router = useRouter()
	const columnGroup = getCardsColumnGroup(router.query)

	const columns = React.useMemo(() => buildCardsColumns(reference), [reference])
	const filteredRows = React.useMemo(
		() =>
			groupCardRows(
				filterCards(
					rows,
					resolveCardsFilterState(
						router.query,
						cardsChainOptions(rows).map((option) => option.key)
					)
				)
			),
		[rows, router.query]
	)

	return (
		<div className="[&_tr.vf-row]:h-[65px]">
			<SearchTableProvider<CardTableRow>
				key={columnGroup}
				options={{
					data: filteredRows,
					columns,
					initialState: { columnVisibility: cardsColumnVisibility(columnGroup) },
					getSubRows: (row) => row.subRows
				}}
			>
				<Card padding="none">
					<TableToolbar>
						<div className="mr-auto flex min-w-0 items-center">
							<SegmentedControl<CardsColumnGroup>
								value={columnGroup}
								onValueChange={(nextGroup) => {
									void pushShallowQuery(router, {
										[CARDS_QUERY_KEYS.columnGroup]: nextGroup === DEFAULT_CARDS_COLUMN_GROUP ? undefined : nextGroup
									})
								}}
								options={CARDS_COLUMN_GROUPS}
								label="Card attributes"
								variant="chips"
								size="md"
							/>
						</div>
						<TableSearchInput
							columnId="name"
							placeholder="Search cards..."
							className={searchFieldInlineWrapperStyles}
						/>
						<TableColumnSelect />
						<TableCsvExport filename="crypto-cards" includeHiddenColumns />
					</TableToolbar>
					<VirtualSearchTableView rowSize={CARDS_ROW_HEIGHT} tableLayout="fixed" />
				</Card>
			</SearchTableProvider>
		</div>
	)
}
