import { ChangeCell, columnHelper, formatTableUsd, numberColumnMeta } from './shared'

export const priceColumn = columnHelper.accessor((row) => row.metrics.price ?? undefined, {
	id: 'price',
	header: 'Price',
	cell: ({ getValue }) => formatTableUsd(getValue()),
	meta: numberColumnMeta('w-[120px]', 'Latest token price in USD.', 'Token Price')
})

const priceChange24hColumn = columnHelper.accessor((row) => row.metrics.priceChange24h ?? undefined, {
	id: 'priceChange24h',
	header: '24h',
	cell: ({ getValue }) => <ChangeCell value={getValue()} />,
	meta: numberColumnMeta('w-[100px]', 'Percent move of the mark price over the last 24 hours.', 'Price Change 24h')
})

/** Perps only: spot rows have no price history. */
export const perpsPricingColumnGroup = columnHelper.group({
	id: 'pricing',
	header: 'Price',
	columns: [priceColumn, priceChange24hColumn]
})
