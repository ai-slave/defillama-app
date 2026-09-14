import { Checkbox } from '~/ui/Checkbox'
import type { RWAGroupBy, RWAGroupByScope, RWATableView } from '../groupBy'
import { RWATableGroupBySelect } from './GroupBySelect'
import { RWATableViewSwitch } from './ViewSwitch'

export type RWATableControlsProps = {
	view: RWATableView
	onViewChange: (view: RWATableView) => void
	groupBy: RWAGroupBy
	/** The page the table sits on; a chain page has no Chain grouping. */
	groupByScope: RWAGroupByScope
	onGroupByChange: (groupBy: RWAGroupBy) => void
	includeCex: boolean
	onIncludeCexChange: (value: boolean) => void
}

/**
 * The controls that set the page's axis and mode: the Group by, the Assets or Perps switch and, in the Perps
 * view, the CEX venues toggle. They drive the charts, the panel and the table, so they sit above the chart,
 * not in the table toolbar.
 */
export function RWATableControls({
	view,
	onViewChange,
	groupBy,
	groupByScope,
	onGroupByChange,
	includeCex,
	onIncludeCexChange
}: RWATableControlsProps) {
	return (
		<>
			<RWATableGroupBySelect view={view} scope={groupByScope} value={groupBy} onChange={onGroupByChange} />
			<RWATableViewSwitch value={view} onChange={onViewChange} />
			{view === 'perps' ? (
				<Checkbox
					variant="filter"
					value="includeCex"
					checked={includeCex}
					onChange={() => onIncludeCexChange(!includeCex)}
				>
					<span className="whitespace-nowrap">CEX Perps</span>
				</Checkbox>
			) : null}
		</>
	)
}
