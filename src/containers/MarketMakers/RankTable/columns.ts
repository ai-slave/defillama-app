import { createColumnHelper } from '@tanstack/react-table'
import { createElement } from 'react'
import { Icon } from '~/components/Icon'
import { TokenLogo } from '~/components/TokenLogo'
import { buttonStyles } from '~/ui/Button'
import { heatmapClass, percentileOpacity, rankOpacity } from '../colors'
import type { ColumnConfig, DisplayMode } from '../constants'
import { selectCellNumber } from '../constants'
import type { LeaderboardRow } from '../types'
import { MetricCell } from './MetricCell'

const columnHelper = createColumnHelper<LeaderboardRow>()

interface IBuildRankColumns {
	columns: ColumnConfig[]
	mode: DisplayMode
	rowCount: number
	onSelectMM: (marketMakerId: string, marketMakerName: string) => void
}

function metricHeatmapClass(metricKey: string, mode: DisplayMode) {
	return (row: LeaderboardRow) => {
		if (mode === 'value') return undefined
		const metric = row.metrics[metricKey]
		const opacity = mode === 'percentile' ? percentileOpacity(metric?.percentile) : rankOpacity(metric?.rank)
		return heatmapClass(opacity)
	}
}

function detailsButton(row: LeaderboardRow, onSelectMM: (id: string, name: string) => void) {
	return createElement(
		'button',
		{
			type: 'button',
			onClick: () => onSelectMM(row.marketMakerId, row.marketMakerName),
			className: buttonStyles({ size: 'md' })
		},
		'Details',
		createElement(Icon, { name: 'arrow-right', height: 12, width: 12 })
	)
}

export function buildRankColumns({ columns, mode, rowCount, onSelectMM }: IBuildRankColumns) {
	const rankColumn = columnHelper.accessor((row) => (row.rank?.value != null ? -row.rank.value : undefined), {
		id: '#',
		header: '#',
		cell: ({ row }) => row.original.rank?.value ?? '',
		sortUndefined: 'last',
		meta: { align: 'start' }
	})

	const marketMakerColumn = columnHelper.display({
		id: 'marketMaker',
		header: 'Market Maker',
		cell: ({ row }) =>
			createElement(
				'button',
				{
					type: 'button',
					onClick: () => onSelectMM(row.original.marketMakerId, row.original.marketMakerName),
					className: 'flex items-center gap-2 text-link hover:underline'
				},
				createElement(TokenLogo, { src: row.original.marketMakerImageUrl, size: 24 }),
				createElement('span', { className: 'truncate' }, row.original.marketMakerName)
			),
		enableSorting: false,
		meta: { cellClassName: 'truncate' }
	})

	const lastIndex = columns.length - 1
	const metricColumns = columns.map((c, index) => {
		const isLast = index === lastIndex
		const heat = metricHeatmapClass(c.metricKey, mode)
		return columnHelper.accessor((row) => selectCellNumber(row.metrics[c.metricKey], mode) ?? undefined, {
			id: c.metricKey,
			header: c.label,
			cell: ({ row }) => {
				const metricCell = createElement(MetricCell, {
					metric: row.original.metrics[c.metricKey],
					market: c.marketKey ? row.original.metrics[c.marketKey] : undefined,
					mode,
					kind: c.kind,
					rowCount
				})
				if (!isLast) return metricCell
				const heatCls = heat(row.original)
				return createElement(
					'div',
					{ className: 'flex h-full items-stretch justify-between' },
					createElement(
						'div',
						{
							className: `flex flex-1 items-center border-b border-subtle px-3 py-3${heatCls ? ` ${heatCls}` : ''}`
						},
						metricCell
					),
					createElement(
						'div',
						{
							className: 'flex items-center border-b border-l border-subtle bg-surface px-3 py-3'
						},
						detailsButton(row.original, onSelectMM)
					)
				)
			},
			sortUndefined: 'last',
			meta: {
				align: 'start',
				cellClass: isLast ? undefined : heat,
				cellClassName: isLast ? 'h-px !p-0 !border-b-0' : undefined
			}
		})
	})

	return [rankColumn, marketMakerColumn, ...metricColumns]
}
