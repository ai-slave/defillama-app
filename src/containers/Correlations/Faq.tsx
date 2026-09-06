import { Card } from '~/ui/Card'

export function FAQ() {
	return (
		<Card padding="sm">
			<div className="mx-auto flex max-w-xl flex-col gap-4">
				<div className="flex flex-col gap-1">
					<h2 className="heading-xs">Correlation</h2>
					Positively correlated variables tend to move together, negatively correlated variables move inversely to each
					other, and uncorrelated variables move independently of each other.
				</div>
				<div className="flex flex-col gap-1">
					<h2 className="heading-xs">Pearson Correlation Coefficient</h2>
					<p>
						The Pearson Correlation Coefficient quantifies the estimated strength of the linear association between two
						variables. It ranges from +1 to -1: +1 indicates a perfect positive linear correlation, -1 a perfect
						negative linear correlation, 0 indicates no linear correlation.
					</p>
				</div>
				<hr className="border-subtle" />
				<div className="flex flex-col gap-3 rounded-lg bg-surface-elevated-1 p-3">
					<h3 className="label-md text-primary">Values</h3>
					<div className="flex flex-col gap-2 body-sm">
						<div className="flex items-start gap-2">
							<span className="mt-0.5 inline-block size-3 shrink-0 rounded-sm bg-[rgba(53,222,59,0.8)]" />
							<p>
								<span className="font-medium text-secondary">Positive:</span> Indicates a positive correlation between
								two variables.
							</p>
						</div>
						<div className="flex items-start gap-2">
							<span className="mt-0.5 inline-block size-3 shrink-0 rounded-sm bg-[rgba(255,0,0,0.8)]" />
							<p>
								<span className="font-medium text-secondary">Negative:</span> Indicates a negative correlation between
								two variables.
							</p>
						</div>
						<div className="flex items-start gap-2">
							<span className="mt-0.5 inline-block size-3 shrink-0 rounded-sm bg-surface-elevated-2" />
							<p>
								<span className="font-medium text-secondary">Zero:</span> No correlation between two variables.
							</p>
						</div>
					</div>
				</div>
			</div>
		</Card>
	)
}
