import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { QuestionHelper } from './QuestionHelper'
import { SurfaceBodyLoadingStatus } from './Status'

/* ----------------------------------------------------------------------------
   Chart panel parts — the chart shell is a `Panel` (./Panel.tsx) holding
   an optional ChartPanelToolbar and a ChartPanelBody. The shell owns chrome and space
   reservation; the route owns metrics, queries, exports and chart logic.

   Toolbar: px-2 pt-2, 32px (md) controls, 6px gaps. What the chart shows
   goes in `leading`: the title, the view switch (Combined / Breakdown, chart
   type), or the Add Metrics picker with its chips. It stays left as one
   group in every mode, so switching views never moves it. A title there is
   ChartPanelTitle, never a hand-styled heading. Every other child
   hugs the right in one order: filters and grouping, then Embed, Add to
   dashboard, reset, .csv, .png. Embed, .csv and .png render only while the
   chart plots a series. A chart under this toolbar takes the handle its
   ChartExportButtons here also take (`exportButtons={chartExport}`,
   `chart={chartExport}`), so the chart never adds a second header row
   (check-chart-exports.ts). Controls keep their natural width and wrap right
   below sm: `filter` select triggers and `default` segmented controls,
   never `responsive`. The toolbar takes no className: callers never
   hand-roll the toolbar div or push groups with `ml-auto` (the
   `chart-toolbar-auto-margin` rule in check-design-tokens.mjs). Controls
   center on the row; beside a tall title block (a title over a
   description, a headline stat) the toolbar passes `align="start"`, so
   they line up with its first line instead of floating beside its middle.
   Caveats go right under the toolbar as a ScopeNote (./ScopeNote.tsx).

   Body: flush; the cartesian plot inset comes from the ECharts grid
   (src/components/ECharts/shared/chartSpacing.ts), never DOM padding.

   Loading, empty and error states in the body's place are the surface body
   parts from ./Status.tsx, SurfaceBodyLoadingStatus and SurfaceBodyStatus;
   a chart's loading part says `label="Loading chart"` or names what loads.
   Suspense fallbacks: a lazy chart inside a mounted body uses
   SurfaceBodyLoadingStatus (360px, announced); a lazy chart that renders its
   own title and export toolbar uses ChartPanelExportShellLoading (400px).
   Keep an external ChartPanelToolbar outside Suspense, so only the body
   waits. check-status-parts.ts refuses a fallback that renders a
   childless ChartPanelBody or div.

   A chart with nothing to plot (no data in the range, no metric picked, a
   filter that matches nothing) renders SurfaceBodyStatus variant="empty"
   with a sentence naming what is missing. It announces itself, so a reader who changes a
   range or filter hears the chart empty. A branch with nothing to show
   renders one of these parts, never an empty box: the body's 360px floor
   would stand blank and silent.

   A failed read renders SurfaceBodyStatus variant="error" where the chart
   would be: the red message and, when the chart's data comes from a query in the browser,
   that query's Try again (`retry`). Check `queryReadFailed` (nothing to draw
   and the read failed) before loading, so the error and its button stay on
   screen while the retry runs. A refetch that fails under a drawn chart keeps
   the chart (`queryRefreshFailed`). Data the server rendered has nothing to
   retry and passes no `retry`.
---------------------------------------------------------------------------- */

type ChartPanelToolbarProps = Omit<ComponentPropsWithoutRef<'div'>, 'className'> & {
	/** What the chart shows: a title, a view switch, or the metric picker and its chips. It stays on the
	    left as one group; every other child hugs the right, and both wrap without swapping sides. */
	leading?: ReactNode
	/** `start` lines the controls up with the top of a tall title block. */
	align?: 'center' | 'start'
}

export function ChartPanelToolbar({ leading, align = 'center', children, ...props }: ChartPanelToolbarProps) {
	return (
		<div
			className={`flex flex-wrap ${align === 'start' ? 'items-start' : 'items-center'} justify-end gap-1.5 px-2 pt-2 pb-0`}
			{...props}
		>
			{leading ? <div className="mr-auto flex min-w-0 flex-wrap items-center gap-1.5">{leading}</div> : null}
			{children}
		</div>
	)
}

/** A chart's title for the toolbar's `leading`: the heading, a "?" for a definition too long for the subtitle, and one
    line under it. A chart that draws its own header (`title` on the renderer) renders this through ChartHeader. */
export function ChartPanelTitle({
	children,
	subtitle,
	titleTooltip,
	headingAs: Heading = 'h3'
}: {
	children: ReactNode
	subtitle?: ReactNode
	titleTooltip?: string | undefined
	headingAs?: 'h1' | 'h2' | 'h3' | 'h4' | undefined
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			{titleTooltip ? (
				// Beside the heading, not in it: the "?" is named by its definition, which would join the heading's name.
				<div className="flex items-center gap-1">
					<Heading className="heading-xs">{children}</Heading>
					<QuestionHelper text={titleTooltip} />
				</div>
			) : (
				<Heading className="heading-xs">{children}</Heading>
			)}
			{subtitle ? <p className="body-sm text-tertiary">{subtitle}</p> : null}
		</div>
	)
}

/* Chart panels in a row stretch to the tallest one, so the body grows with them and its 360px is a FLOOR, not a fixed
   height: a fixed body left dead space under the chart in every panel the grid stretched. A chart beside something
   that is not a chart (a summary card, a table, a list) keeps its own height: that row aligns to the top
   (`items-start`, as SummaryCardGrid does), or the chart grows with every row its neighbor adds. A chart without
   `height` fills the body it sits in (src/components/ECharts/README.md → Size). The floor is an `initial:` default, as
   in Status.tsx, so a deliberately tall chart (a 600px treemap) raises it with its own min-h-* class on the body and
   on its fallback. */
export function ChartPanelBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
	return <div className={`relative flex flex-1 flex-col initial:min-h-[360px] ${className ?? ''}`.trim()} {...props} />
}

/** A lazy chart that draws its own title and export row, loading: SurfaceBodyLoadingStatus over the 400px the toolbar
    and body take together. `className` is grid placement only (col-span-*). */
export function ChartPanelExportShellLoading({
	label = 'Loading chart',
	className
}: {
	label?: string
	className?: string
}) {
	return <SurfaceBodyLoadingStatus label={label} className={`min-h-[400px] ${className ?? ''}`.trim()} />
}
