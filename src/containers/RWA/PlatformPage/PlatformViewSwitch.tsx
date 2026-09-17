import { SegmentedControl } from '~/ui/SegmentedControl'
import { RWA_PLATFORM_VIEW_OPTIONS, type RWAPlatformView } from './view'

/** The platform page's view switch, mounted first in the strip where the overview's Assets or Perps switch sits. */
export function RWAPlatformViewSwitch({
	value,
	onChange
}: {
	value: RWAPlatformView
	onChange: (view: RWAPlatformView) => void
}) {
	return (
		<SegmentedControl<RWAPlatformView>
			value={value}
			onValueChange={onChange}
			options={RWA_PLATFORM_VIEW_OPTIONS}
			label="Platform view"
			variant="default"
			size="md"
		/>
	)
}
