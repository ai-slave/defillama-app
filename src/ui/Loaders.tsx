export function LoadingDots() {
	return (
		<span className="flex gap-0.5">
			<span className="animate-bounce [animation-delay:-0.3s]">.</span>
			<span className="animate-bounce [animation-delay:-0.15s]">.</span>
			<span className="animate-bounce">.</span>
		</span>
	)
}

/** The spinner for buttons and inline controls; never hand-roll an `animate-spin` border circle. It is a block-level
    flex box, so a wrapper around it (a role="status" span) holds no text line and the spinner centres in its row;
    an inline-flex spinner rode that line's baseline, above centre. */
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
