import { TagGroup } from '~/ui/SegmentedControl'
import { RWA_CHANGE_PERIODS, type RWAChangePeriod } from '../change'

/** The 1d, 7d, 1m switch from the protocols table. */
export function RWATablePeriodSwitch({
	value,
	onChange
}: {
	value: RWAChangePeriod
	onChange: (period: RWAChangePeriod) => void
}) {
	return (
		<TagGroup
			variant="default"
			setValue={onChange}
			selectedValue={value}
			values={RWA_CHANGE_PERIODS}
			ariaLabel="Change period"
			size="md"
		/>
	)
}
