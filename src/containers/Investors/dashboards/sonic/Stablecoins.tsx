import { Card } from '~/ui/Card'
const SKELETON_WIDTHS = [
	['w-16', 'w-2/3', 'w-12', 'w-24', 'w-10'],
	['w-14', 'w-1/2', 'w-14', 'w-20', 'w-16'],
	['w-16', 'w-3/4', 'w-16', 'w-14', 'w-12'],
	['w-14', 'w-2/5', 'w-12', 'w-20', 'w-14'],
	['w-16', 'w-3/5', 'w-14', 'w-16', 'w-10'],
	['w-14', 'w-1/2', 'w-16', 'w-24', 'w-12']
]

export default function Stablecoins() {
	return (
		<div className="flex min-h-[calc(100vh-180px)] flex-col">
			<div className="relative flex-1">
				<Card padding="none" className="overflow-hidden">
					<div className="flex flex-col">
						<div className="flex border-b border-subtle">
							{Array.from({ length: 5 }).map((_, i) => (
								// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
								<div key={i} className="flex-1 px-4 py-3.5">
									<div className="h-2.5 w-16 rounded-full bg-skeleton" />
								</div>
							))}
						</div>
						{SKELETON_WIDTHS.map((widths, r) => (
							<div
								// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
								key={r}
								className="flex border-b border-subtle last:border-b-0"
								style={{ opacity: 1 - r * 0.08 }}
							>
								{widths.map((w, c) => (
									// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
									<div key={c} className="flex-1 px-4 py-3.5">
										<div className={`${w} h-3 rounded-full bg-skeleton`} />
									</div>
								))}
							</div>
						))}
					</div>
					<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-surface via-transparent to-transparent" />
				</Card>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="rounded-full border border-medium bg-overlay px-5 py-2.5 title-md tracking-wide text-secondary">
						Stablecoins — Coming soon
					</span>
				</div>
			</div>
		</div>
	)
}
