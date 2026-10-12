import { useRouter } from 'next/router'
import * as React from 'react'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { SearchTableView } from '~/components/Table/search/SearchTableView'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { Card } from '~/ui/Card'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { ExchangeCountrySelect, useExchangeCountry } from './ExchangeCountrySelect'
import type { RampCatalogModel } from './models'
import { EXCHANGES_QUERY_KEYS, getRampCurrency, getRampSize } from './queryState'
import { buildRampColumns, RAMP_HIDDEN_COLUMNS } from './rampColumns'
import { buildRampRows, DEFAULT_RAMP_CURRENCY, rampCurrencyOptions } from './rampPresentation'

export function RampTable({ catalog }: { catalog: RampCatalogModel }) {
	const router = useRouter()
	const { country, setCountry, catalog: regionCatalog, catalogFailed } = useExchangeCountry()
	const size = getRampSize(router.query, catalog.sizes)
	const requestedCurrency = getRampCurrency(router.query)
	// USD unless the reader picks otherwise — see DEFAULT_RAMP_CURRENCY.
	const currency = requestedCurrency ?? DEFAULT_RAMP_CURRENCY

	const rows = React.useMemo(
		() => buildRampRows(catalog, { country, regionCatalog, currency, size }),
		[catalog, country, regionCatalog, currency, size]
	)
	const columns = React.useMemo(() => buildRampColumns({ size, currency, country }), [size, currency, country])
	// USD is always offered even where no visible venue publishes a USD rail, so the
	// default selection is never absent from its own dropdown.
	const currencyOptions = React.useMemo(
		() => [...new Set([DEFAULT_RAMP_CURRENCY, ...rampCurrencyOptions(rows, size)])].sort(),
		[rows, size]
	)

	return (
		<SearchTableProvider
			options={{
				data: rows,
				columns,
				initialState: {
					// Preserve REAL order from buildRampRows, with cost as the tiebreak.
					sorting: [],
					columnVisibility: RAMP_HIDDEN_COLUMNS
				}
			}}
		>
			<Card padding="none">
				<TableToolbar>
					<TableToolbarControlGroup className="mr-auto">
						<ExchangeCountrySelect
							catalog={regionCatalog}
							catalogFailed={catalogFailed}
							selectedCountry={country}
							onCountryChange={setCountry}
						/>
						<SelectWithCombobox
							allValues={currencyOptions}
							selectedValues={[currency]}
							setSelectedValues={(values) => {
								const next = values[0]
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.rampCurrency]:
										!next || next === DEFAULT_RAMP_CURRENCY ? undefined : next.toLowerCase()
								})
							}}
							label="Currency"
							labelType="regular"
							singleSelect
							variant="filter"
							size="md"
							searchPlaceholder="Search currencies…"
						/>
						<SegmentedControl<string>
							value={String(size)}
							onValueChange={(next) => {
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.rampSize]: Number(next) === catalog.sizes[0] ? undefined : next
								})
							}}
							options={catalog.sizes.map((option) => ({
								value: String(option),
								label: formatUsd(option, { compact: true }) ?? String(option)
							}))}
							label="Order size"
							variant="default"
							size="md"
						/>
					</TableToolbarControlGroup>
					<TableSearchInput columnId="name" placeholder="Search exchanges…" width="inline" />
					<TableColumnSelect />
					<TableCsvExport filename="fiat-ramp-costs" includeHiddenColumns />
				</TableToolbar>
				<SearchTableView columnSizing="content" />
			</Card>
		</SearchTableProvider>
	)
}
