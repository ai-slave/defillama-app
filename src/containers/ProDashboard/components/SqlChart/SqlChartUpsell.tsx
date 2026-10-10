import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { PromoBadge } from '~/ui/PromoBadge'
import { EmptyState } from '~/ui/Status'

export function SqlChartUpsell() {
	return (
		<EmptyState
			size="md"
			icon="file-lock-2"
			title="Author charts from SQL"
			actions={
				<div className="flex flex-col items-center gap-3">
					<PromoBadge>API plan</PromoBadge>
					<ul className="flex max-w-md flex-col gap-1.5 text-left body-sm text-tertiary">
						<li>· Query fees, revenue, TVL, yields, stablecoins and more</li>
						<li>· Any chart type — bar, line, pie, treemap or table</li>
						<li>· Cross-join datasets the standard cards can't</li>
					</ul>
					{/* The API plan's purple, through its token scope. */}
					<div className="sub-api-accent">
						<Button as={BasicLink} href="/subscription" variant="primary" size="sm">
							Upgrade to API plan
						</Button>
					</div>
				</div>
			}
		>
			Write SQL against any DefiLlama dataset, pick a chart and pin it to your dashboard. Available with an active API
			subscription.
		</EmptyState>
	)
}
