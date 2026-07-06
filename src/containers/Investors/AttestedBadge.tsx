export function AttestedBadge() {
	return (
		<span
			title="Official metrics, reports & calls, attested by DefiLlama"
			className="inline-flex shrink-0 items-center gap-1 rounded-full border border-(--sl-accent)/35 bg-(--sl-accent)/8 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-(--sl-accent) max-sm:hidden"
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="size-2.5 shrink-0"
				aria-hidden="true"
			>
				<path d="M20 6L9 17l-5-5" />
			</svg>
			Attested by DefiLlama
		</span>
	)
}
