export function UniversalTokenRatingNavIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="size-4 shrink-0 text-utr-grade-on-color group-hover/link:animate-wiggle"
		>
			<clipPath id="utr-nav-tile">
				<rect width="24" height="24" rx="5" />
			</clipPath>
			<g clipPath="url(#utr-nav-tile)">
				<rect width="24" height="24" rx="5" className="fill-utr-grade-aaa" />
				<path
					d="M8 17 12 7l4 10M9.9 13.8h4.2"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path d="M8 -2h5L5 26H0Z" fill="currentColor" opacity="0.3" className="utr-nav-glint" />
			</g>
		</svg>
	)
}
