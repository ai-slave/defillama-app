import { DialogBody, DialogHeader, SideSheet } from '~/ui/Dialog'
import { TagGroup } from '~/ui/SegmentedControl'
import { Switch } from '~/ui/Switch'
import { TIMEFRAMES, type Timeframe } from '../constants'

// Choices apply as they change, so the sheet has no footer: the × or a tap outside closes it.
export function RefineDrawer({
	open,
	onClose,
	timeframe,
	setTimeframe,
	applyToAll,
	setApplyToAll
}: {
	open: boolean
	onClose: () => void
	timeframe: Timeframe
	setTimeframe: (value: Timeframe) => void
	applyToAll: boolean
	setApplyToAll: (value: boolean) => void
}) {
	return (
		<SideSheet size="sm" open={open} onClose={onClose} portal unmountOnHide>
			<DialogHeader title="Refine leaderboard" subtitle="Choose the period the market maker rankings cover." />
			<DialogBody>
				<div className="flex flex-col gap-2">
					<span className="label-sm text-secondary">Timeframe</span>
					<TagGroup
						selectedValue={timeframe}
						setValue={setTimeframe}
						values={TIMEFRAMES}
						variant="field"
						size="md"
						ariaLabel="Timeframe"
					/>
				</div>
				<div className="flex flex-col gap-1.5 border-t border-subtle pt-4">
					<Switch
						label="Apply to all leaderboards"
						value="applyToAll"
						checked={applyToAll}
						onChange={(e) => setApplyToAll(e.target.checked)}
					/>
					<p className="body-sm text-secondary">Every leaderboard uses this timeframe instead of its own.</p>
				</div>
			</DialogBody>
		</SideSheet>
	)
}
