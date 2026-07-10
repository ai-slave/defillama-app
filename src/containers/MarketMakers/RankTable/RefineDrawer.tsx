import { TagGroup } from '~/components/TagGroup'
import { Switch } from '~/ui/Switch'
import { TIMEFRAMES, type Timeframe } from '../constants'
import { Drawer } from '../Drawer'
import { SlidersIcon } from '../icons'

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
		<Drawer
			open={open}
			onClose={onClose}
			title={
				<span className="flex items-center gap-2">
					<SlidersIcon />
					Refine Leaderboard
				</span>
			}
		>
			<div className="flex flex-col gap-4 p-4">
				<p className="body-md text-secondary">
					Select the parameters to view the market maker rankings with a more detailed view.
				</p>
				<div className="rounded-lg bg-brand-muted p-3">
					<Switch
						className="w-full flex-row-reverse justify-between font-semibold"
						label="Apply preferences to all leaderboards"
						value="applyToAll"
						checked={applyToAll}
						onChange={(e) => setApplyToAll(e.target.checked)}
					/>
				</div>
				<div className="flex flex-col gap-3 rounded-lg border border-subtle p-4">
					<span className="label-md text-primary">Timeframe</span>
					<TagGroup
						selectedValue={timeframe}
						setValue={setTimeframe}
						values={TIMEFRAMES}
						variant="responsive"
						size="md"
						className="w-full"
					/>
				</div>
			</div>
		</Drawer>
	)
}
