import { SegmentedControl } from '~/ui/SegmentedControl'
import type { RWASection } from '../../layout/pageLayout'
import { getRwaTableColumnSetOptions, type RWATableColumnSet } from '../columnSetQuery'

/** Metrics or Compliance on asset rows; perps rows have one set, so no switch. It changes the table's columns only. */
export function RWATableColumnSetSwitch({
	section,
	value,
	onChange
}: {
	section: RWASection
	value: RWATableColumnSet
	onChange: (columnSet: RWATableColumnSet) => void
}) {
	const options = getRwaTableColumnSetOptions(section)
	if (options.length < 2) return null
	return (
		<SegmentedControl<RWATableColumnSet>
			value={value}
			onValueChange={onChange}
			options={options}
			label="Table columns"
			variant="default"
			size="md"
		/>
	)
}
