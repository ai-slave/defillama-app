import { columnHelper, formatTableUsd, numberColumnMeta } from './shared'

export const priceColumn = columnHelper.accessor((row) => row.metrics.price ?? undefined, {
	id: 'price',
	header: 'Price',
	cell: ({ getValue }) => formatTableUsd(getValue()),
	meta: numberColumnMeta('w-[120px]', 'Latest token price in USD.', 'Token Price')
})
