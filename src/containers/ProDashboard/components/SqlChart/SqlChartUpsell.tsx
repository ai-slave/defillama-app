import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

export function SqlChartUpsell() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
			<Icon name="file-lock-2" height={32} width={32} className="text-tertiary" />
			<span className="rounded-full border border-brand-muted bg-brand-tint px-2.5 py-0.5 label-xs text-link">
				API plan
			</span>
			<h3 className="heading-xs text-primary">Author charts from SQL</h3>
			<p className="max-w-md body-md text-secondary">
				Write SQL against any DefiLlama dataset, pick a chart and pin it to your dashboard. Available with an active API
				subscription.
			</p>
			<ul className="flex max-w-md flex-col gap-1.5 text-left body-sm text-tertiary">
				<li>· Query fees, revenue, TVL, yields, stablecoins and more</li>
				<li>· Any chart type — bar, line, pie, treemap or table</li>
				<li>· Cross-join datasets the standard cards can't</li>
			</ul>
			{/* The API plan's purple, through its token scope. */}
			<div className="sub-api-accent mt-2">
				<Button as={BasicLink} href="/subscription" variant="primary" size="md">
					Upgrade to API plan
				</Button>
			</div>
		</div>
	)
}
