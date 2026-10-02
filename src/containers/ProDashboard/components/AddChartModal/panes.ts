import type { SegmentedControlOption } from '~/ui/SegmentedControl'

// Below lg a tab's configuration and preview panes stack, so phones switch between them; from lg both show side by side.
export type AddCardPane = 'configure' | 'preview'

export const ADD_CARD_PANES: ReadonlyArray<SegmentedControlOption<AddCardPane>> = [
	{ value: 'configure', label: 'Configure' },
	{ value: 'preview', label: 'Preview' }
]
