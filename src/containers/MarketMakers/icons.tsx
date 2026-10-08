export function ArrowRightIcon({ className }: { className?: string }) {
	return (
		<svg
			width="14"
			height="12"
			viewBox="0 0 14 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={`shrink-0 ${className ?? ''}`}
			aria-hidden
		>
			<path
				d="M7.75 10.75L12.75 5.75L7.75 0.75M12.75 5.75H0.75"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export function SlidersIcon({ className }: { className?: string }) {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<path
				d="M7 4L13.5 4M5 4C5 3.44771 5.44772 3 6 3C6.55229 3 7 3.44772 7 4C7 4.55228 6.55228 5 6 5C5.44772 5 5 4.55228 5 4ZM2.5 4H5M7 12H13.5M5 12C5 11.4477 5.44772 11 6 11C6.55228 11 7 11.4477 7 12C7 12.5523 6.55228 13 6 13C5.44772 13 5 12.5523 5 12ZM2.5 12L5 12M11 8L13.5 8M9 8C9 7.44771 9.44772 7 10 7C10.5523 7 11 7.44772 11 8C11 8.55228 10.5523 9 10 9C9.44772 9 9 8.55228 9 8ZM2.5 8H9"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
