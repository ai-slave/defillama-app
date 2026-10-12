import { DialogBody, DialogHeader, SideSheet } from '~/ui/Dialog'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TIMEFRAME_OPTIONS, type Timeframe } from '../constants'

// Choices apply as they change, so the sheet has no footer: the × or a tap outside closes it.
export function RefineDrawer({
	open,
	onClose,
	timeframe,
	setTimeframe
}: {
	open: boolean
	onClose: () => void
	timeframe: Timeframe
	setTimeframe: (value: Timeframe) => void
}) {
	return (
		<SideSheet size="sm" open={open} onClose={onClose} portal unmountOnHide>
			<DialogHeader title="Refine leaderboard" subtitle="Choose the period the market maker rankings cover." />
			<DialogBody>
				<div className="flex flex-col gap-2">
					<span className="label-sm text-secondary">Timeframe</span>
					<SegmentedControl
						value={timeframe}
						onValueChange={setTimeframe}
						options={TIMEFRAME_OPTIONS}
						variant="field"
						size="md"
						label="Timeframe"
					/>
				</div>
			</DialogBody>
		</SideSheet>
	)
}
