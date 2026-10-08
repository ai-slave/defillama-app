import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'

export function SqlChartUpsell() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
			<Icon name="file-lock-2" height={32} width={32} className="text-pro-text-tertiary" />
			<span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 label-xs text-link">API plan</span>
			<h3 className="heading-xs text-pro-text-primary">Author charts from SQL</h3>
			<p className="max-w-md body-md text-pro-text-secondary">
				Write SQL against any DefiLlama dataset, pick a chart and pin it to your dashboard. Available with an active API
				subscription.
			</p>
			<ul className="flex max-w-md flex-col gap-1.5 text-left body-sm text-pro-text-tertiary">
				<li>· Query fees, revenue, TVL, yields, stablecoins and more</li>
				<li>· Any chart type — bar, line, pie, treemap or table</li>
				<li>· Cross-join datasets the standard cards can't</li>
			</ul>
			<BasicLink
				href="/subscription"
				className="mt-2 rounded-md bg-brand px-4 py-2 label-md text-on-brand transition-colors hover:opacity-90"
			>
				Upgrade to API plan
			</BasicLink>
		</div>
	)
}
