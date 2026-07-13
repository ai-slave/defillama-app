import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'

export function SqlChartUpsell() {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
			<Icon name="file-lock-2" height={32} width={32} className="pro-text3" />
			<span className="rounded-full border border-(--primary)/30 bg-(--primary)/10 px-2.5 py-0.5 text-[11px] font-medium text-(--primary)">
				API plan
			</span>
			<h3 className="text-lg font-semibold pro-text1">Author charts from SQL</h3>
			<p className="max-w-md text-sm pro-text2">
				Write SQL against any DefiLlama dataset, pick a chart and pin it to your dashboard. Available with an active API
				subscription.
			</p>
			<ul className="flex max-w-md flex-col gap-1.5 text-left text-xs pro-text3">
				<li>· Query fees, revenue, TVL, yields, stablecoins and more</li>
				<li>· Any chart type — bar, line, pie, treemap or table</li>
				<li>· Cross-join datasets the standard widgets can't</li>
			</ul>
			<BasicLink
				href="/subscription"
				className="mt-2 rounded-md bg-(--primary) px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
			>
				Upgrade to API plan
			</BasicLink>
		</div>
	)
}
