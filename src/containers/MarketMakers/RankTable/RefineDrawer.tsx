import { Switch } from '~/components/Switch'
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
				<p className="text-sm text-(--text-secondary)">
					Select the parameters to view the market maker rankings with a more detailed view.
				</p>
				<div className="rounded-lg bg-(--link-hover-bg) px-4 py-3">
					<Switch
						className="w-full flex-row-reverse justify-between font-semibold"
						label="Apply preferences to all leaderboards"
						value="applyToAll"
						checked={applyToAll}
						onChange={(e) => setApplyToAll(e.target.checked)}
					/>
				</div>
				<div className="flex flex-col gap-3 rounded-lg border border-(--cards-border) p-4">
					<span className="text-base font-semibold">Timeframe</span>
					<div className="grid grid-cols-2 gap-2">
						{TIMEFRAMES.map((tf) => (
							<button
								key={tf}
								type="button"
								onClick={() => setTimeframe(tf)}
								className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
									tf === timeframe
										? 'border-(--text-primary) bg-(--text-primary) text-(--cards-bg)'
										: 'border-(--form-control-border) text-(--text-primary) hover:bg-(--link-hover-bg)'
								}`}
							>
								{tf}
							</button>
						))}
					</div>
				</div>
			</div>
		</Drawer>
	)
}
