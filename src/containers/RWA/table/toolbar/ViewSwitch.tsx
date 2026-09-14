import { SegmentedControl } from '~/ui/SegmentedControl'
import type { RWATableView } from '../groupBy'

const VIEW_OPTIONS = [
	{ value: 'assets', label: 'Assets' },
	{ value: 'perps', label: 'Perps', tooltip: 'Perpetual futures on RWA reference assets, with their own columns.' }
] as const

export function RWATableViewSwitch({
	value,
	onChange
}: {
	value: RWATableView
	onChange: (view: RWATableView) => void
}) {
	return (
		<SegmentedControl<RWATableView>
			value={value}
			onValueChange={onChange}
			options={VIEW_OPTIONS}
			label="Table view"
			variant="default"
			size="md"
		/>
	)
}
