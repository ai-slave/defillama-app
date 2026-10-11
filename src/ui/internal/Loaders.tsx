/* ----------------------------------------------------------------------------
   The pieces every loading state in src/ui is drawn from. Pages never render
   them: a bare spinner or "Loading" line names nothing, announces nothing and
   sits wherever the page put it. The finished parts place, label and
   announce them: the loading parts in ../Status.tsx and ../NoResults.tsx,
   BusyGlyph, and the busy state of Button, Switch, MetricChip and UploadTile
   (design.md, Which component for which job).
---------------------------------------------------------------------------- */

function LoadingDots() {
	return (
		<span className="flex gap-0.5">
			<span className="animate-bounce [animation-delay:-0.3s]">.</span>
			<span className="animate-bounce [animation-delay:-0.15s]">.</span>
			<span className="animate-bounce">.</span>
		</span>
	)
}

/** The one spinner; never hand-roll an `animate-spin` border circle. It is a block-level flex box, so the
    role="status" span around it holds no text line and the spinner centres in its row; an inline-flex spinner rode
    that line's baseline, above centre. */
export function LoadingSpinner({ size }: { size: number }) {
	return (
		<span className="flex shrink-0 animate-spin">
			<svg
				className="shrink-0"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				width={size}
				height={size}
			>
				<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
				<path
					className="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		</span>
	)
}

/** The app's loading indicator: quiet tertiary text matching the empty/error copy. */
export function LoadingIndicator({ label }: { label: string }) {
	return (
		<span className="flex items-center gap-1 body-sm text-tertiary">
			{label}
			<LoadingDots />
		</span>
	)
}
