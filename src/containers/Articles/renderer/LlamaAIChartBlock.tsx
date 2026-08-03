import { Suspense } from 'react'
import { isChartConfiguration, isChartData } from '~/containers/LlamaAI/chartTypes'
import { DeferredChartRenderer } from '~/containers/LlamaAI/components/charts/DeferredChartRenderer'

export function LlamaAIChartBlock({ attrs, index }: { attrs: Record<string, unknown>; index: number | null }) {
	const config = isChartConfiguration(attrs.chartConfig) ? attrs.chartConfig : null
	const chartData = isChartData(attrs.chartData) ? attrs.chartData : null
	if (!config || !chartData) return null
	const caption = typeof attrs.caption === 'string' ? attrs.caption.trim() : ''

	return (
		<figure className="my-6 flex flex-col gap-2">
			<div className="rounded-md border border-medium bg-surface">
				<Suspense
					fallback={
						<div className="flex h-[380px] items-center justify-center text-xs text-tertiary">Loading chart…</div>
					}
				>
					<DeferredChartRenderer charts={[config]} chartData={chartData} readOnly />
				</Suspense>
			</div>
			{caption && index !== null ? (
				<figcaption className="flex flex-wrap items-baseline justify-between gap-3 border-t border-medium pt-2 text-[13px] leading-snug text-secondary">
					<div className="min-w-0 flex-1">
						<span className="mr-1.5 font-semibold text-primary">Figure {index}.</span>
						<span>{caption}</span>
					</div>
					<div className="shrink-0 font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
						Source · LlamaAI
					</div>
				</figcaption>
			) : null}
		</figure>
	)
}
