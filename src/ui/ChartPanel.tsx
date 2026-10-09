import type { ComponentProps, ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import type { QueryRetry } from '~/utils/query'
import { Button } from './Button'
import { focusRegionOnLeave } from './focus'
import { Panel } from './Panel'

/* ----------------------------------------------------------------------------
   ChartPanel — the chart shell: `Panel padding="none"`, an optional
   ChartPanelToolbar, and a ChartPanelBody. The shell owns chrome and space
   reservation; the route owns metrics, queries, exports and chart logic.

   Toolbar: px-2 pt-2, 32px (md) controls, 6px gaps. What the chart shows
   goes in `leading`: the title, the view switch (Combined / Breakdown, chart
   type), or the Add Metrics picker with its chips. It stays left as one
   group in every mode, so switching views never moves it. Every other child
   hugs the right in one order: filters and grouping, then Embed, Add to
   dashboard, reset, .csv, .png. Embed, .csv and .png render only while the
   chart plots a series. Controls keep their natural width and wrap right
   below sm: `filter` select triggers and `default` segmented controls,
   never `responsive`. Callers never pass `justify-*`, hand-roll the toolbar
   div, or push groups with `ml-auto` (the `chart-toolbar-auto-margin` rule
   in check-design-tokens.mjs). Caveats go right under the toolbar as a
   ScopeNote (./ScopeNote.tsx).

   Body: flush; the cartesian plot inset comes from the ECharts grid
   (src/components/ECharts/shared/chartSpacing.ts), never DOM padding.

   Suspense fallbacks: a lazy chart inside a mounted body uses
   ChartPanelBodyFallback (360px); a lazy chart that renders its own title
   and export toolbar uses ChartPanelExportShellFallback (400px). Keep an
   external ChartPanelToolbar outside Suspense, so only the body waits.

   A failed read renders ChartPanelBodyError where the chart would be: the
   red message and, when the chart's data comes from a query in the browser,
   that query's Try again (`retry`). Check `queryReadFailed` before loading,
   so the error and its button stay on screen while the retry runs. Data the
   server rendered has nothing to retry and passes no `retry`.
---------------------------------------------------------------------------- */

export function ChartPanel({ className, ...props }: ComponentProps<'div'>) {
	return <Panel padding="none" className={className} {...props} />
}

type ChartPanelToolbarProps = ComponentPropsWithoutRef<'div'> & {
	/** What the chart shows: a title, a view switch, or the metric picker and its chips. It stays on the
	    left as one group; every other child hugs the right, and both wrap without swapping sides. */
	leading?: ReactNode
}

export function ChartPanelToolbar({ leading, className, children, ...props }: ChartPanelToolbarProps) {
	return (
		<div
			className={`flex flex-wrap items-center justify-end gap-1.5 px-2 pt-2 pb-0 ${className ?? ''}`.trim()}
			{...props}
		>
			{leading ? <div className="mr-auto flex min-w-0 flex-wrap items-center gap-1.5">{leading}</div> : null}
			{children}
		</div>
	)
}

/* Panels in a row stretch to the tallest one, so the body grows with them and its 360px is a FLOOR, not a fixed
   height: a fixed body left dead space under the chart in every panel the grid stretched. Pass CHART_FILL to the chart
   itself so it fills the body it sits in. The floor is an `initial:` default, as in Status.tsx, so a deliberately tall
   chart (a 600px treemap) raises it with its own min-h-* class on the body and on its fallback. */
export const CHART_FILL = 'flex-1 min-h-[360px]'

export function ChartPanelBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`relative flex flex-1 flex-col initial:min-h-[360px] ${className ?? ''}`.trim()} {...props} />
}

export function ChartPanelBodyFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return (
		<div
			className={`m-auto flex items-center justify-center initial:min-h-[360px] ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}

/** A chart's failed read, in the body's place. Its Try again waits while the query refetches; when the chart replaces
    it, focus moves to the page content rather than dropping to the document. `style` takes the loading state's height
    where the chart sets its own, so the page does not jump when the error replaces it. */
export function ChartPanelBodyError({
	children,
	retry,
	style
}: {
	children: ReactNode
	retry?: QueryRetry
	style?: CSSProperties
}) {
	return (
		<ChartPanelBodyFallback className="flex-col gap-2 p-4 text-center" style={style}>
			<p role="alert" className="body-sm text-error">
				{children}
			</p>
			{retry ? (
				<Button
					ref={focusRegionOnLeave}
					size="sm"
					onClick={() => void retry.refetch()}
					pendingLabel="Retrying…"
					pending={retry.isFetching}
				>
					Try again
				</Button>
			) : null}
		</ChartPanelBodyFallback>
	)
}

export function ChartPanelExportShellFallback({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`initial:min-h-[400px] ${className ?? ''}`.trim()} {...props} />
}
