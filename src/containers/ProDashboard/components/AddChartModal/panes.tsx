import { Icon } from '~/ui/Icon'
import type { SegmentedControlOption } from '~/ui/SegmentedControl'

// Below lg a tab's configuration and preview panes stack, so phones switch between them; from lg both show side by side.
export type AddCardPane = 'configure' | 'preview'

export const ADD_CARD_PANES: ReadonlyArray<SegmentedControlOption<AddCardPane>> = [
	{ value: 'configure', label: 'Configure' },
	{ value: 'preview', label: 'Preview' }
]

// The chain/protocol switch shared by the chart and metric tabs; the field variant lays the icon beside the label.
export const SUBJECT_OPTIONS: ReadonlyArray<SegmentedControlOption<'chain' | 'protocol'>> = [
	{
		value: 'chain',
		label: (
			<>
				<Icon name="chain" className="size-3.5" />
				Chains
			</>
		)
	},
	{
		value: 'protocol',
		label: (
			<>
				<Icon name="protocol" className="size-3.5" />
				Protocols
			</>
		)
	}
]
