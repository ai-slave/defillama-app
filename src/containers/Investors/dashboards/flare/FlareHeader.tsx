const LINK_ICONS: Record<string, React.ReactNode> = {
	website: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	),
	docs: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	),
	x: (
		<svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	),
	github: (
		<svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0">
			<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
		</svg>
	),
	explorer: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<circle cx="11" cy="11" r="8" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
	)
}

const LINK_LABELS: Record<string, string> = {
	website: 'Website',
	docs: 'Docs',
	x: 'X',
	github: 'GitHub',
	explorer: 'Explorer'
}

function FlareLogo() {
	// Official Flare wordmark in brand crimson — same in light and dark mode.
	return (
		<svg
			viewBox="0 0 99 35"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="Flare"
			className="h-7 w-auto shrink-0"
		>
			<g clipPath="url(#flare-logo-clip)">
				<path
					d="M20.3346 14.1946L9.35592 14.1865C6.36332 14.1838 3.87408 16.7255 3.79395 19.9934C3.79395 20.0795 3.85906 20.1521 3.93919 20.1521L14.9179 20.1602C17.9105 20.1602 20.3997 17.6185 20.4774 14.3533C20.4774 14.2672 20.4122 14.1946 20.3321 14.1946H20.3346Z"
					fill="#E62058"
				/>
				<path
					d="M26.398 5.98072L9.48135 5.97266C6.41864 5.97266 3.87577 8.5132 3.79382 11.7796C3.79382 11.8656 3.8604 11.9382 3.94235 11.9382L20.859 11.9463C23.9191 11.9463 26.4645 9.40575 26.5439 6.14203C26.5439 6.056 26.4773 5.98341 26.3954 5.98341L26.398 5.98072Z"
					fill="#E62058"
				/>
				<path
					d="M7.98851 28.1456C9.53589 27.5141 10.27 25.7675 9.62868 24.2438C8.98735 22.7202 7.21345 21.9973 5.66608 22.6288C4.1187 23.2603 3.38458 25.007 4.02591 26.5306C4.66724 28.0543 6.44113 28.7771 7.98851 28.1456Z"
					fill="#E62058"
				/>
				<path d="M49.6844 6.44189H45.6697V28.5284H49.6844V6.44189Z" fill="#E62058" />
				<path
					d="M94.723 21.0176C94.723 16.9115 91.7888 13.4736 87.6491 13.4736C83.1988 13.4736 80.3557 17.0644 80.3557 21.1705C80.3557 25.7953 83.7255 28.8375 88.2029 28.8375C90.5192 28.8375 92.8997 27.8965 94.3516 26.1909L92.0657 23.9401C91.3566 24.7014 89.9958 25.6423 88.2974 25.6423C86.1668 25.6423 84.465 24.2127 84.2489 22.1447H94.6285C94.6893 21.8089 94.7197 21.4132 94.7197 21.0176H94.723ZM84.4346 19.2521C84.6203 17.9122 85.9811 16.6654 87.6491 16.6654C89.3171 16.6654 90.4922 17.9421 90.6171 19.2521H84.438H84.4346Z"
					fill="#E62058"
				/>
				<path
					d="M63.7426 15.1731L63.459 14.9437C62.2468 13.9695 60.7307 13.4575 59.0762 13.4575C54.95 13.4575 51.7186 16.8455 51.7186 21.1677C51.7186 23.0994 52.4007 24.9413 53.6365 26.351C55.0007 27.9137 57.1144 28.8446 59.2923 28.8446C60.8725 28.8446 62.2738 28.3459 63.4522 27.3584L63.7392 27.1191V28.5321H67.3454V13.7634H63.7392V15.1665L63.7426 15.1731ZM59.5692 25.7226C57.1617 25.7226 55.1999 23.6979 55.1999 21.2043C55.1999 18.7107 57.1617 16.6859 59.5692 16.6859C61.9767 16.6859 63.9384 18.7107 63.9384 21.2043C63.9384 23.6979 61.9767 25.7226 59.5692 25.7226Z"
					fill="#E62058"
				/>
				<path
					d="M77.8303 13.4608C76.1758 13.4608 74.6597 13.9762 73.4475 14.947L73.1639 15.1764V13.7734H69.5577V28.5387H73.1605V20.8419C73.1605 19.6549 73.6501 18.5012 74.5618 17.7232C75.3182 17.0782 76.2872 16.6892 77.3407 16.6892C78.0397 16.6892 78.6981 16.8588 79.2856 17.1613L80.4776 13.9562C79.6604 13.6371 78.769 13.4575 77.8303 13.4575V13.4608Z"
					fill="#E62058"
				/>
				<path
					d="M35.0762 28.5269H38.8445V16.8336H43.126V13.7449H38.8445V13.1066C38.8445 11.6536 39.0775 11.0685 39.4523 10.5997C39.9824 9.9746 40.8029 9.66207 41.8969 9.66207C42.2312 9.66207 42.6566 9.70862 42.9943 9.78177L43.5649 6.65647C42.866 6.49023 42.1873 6.42041 41.3263 6.42041C39.486 6.42041 37.8315 7.0355 36.6666 8.1493C35.5658 9.20325 35.0729 10.6861 35.0729 12.9536V13.7482H32.3142V16.837H35.0729V28.5302L35.0762 28.5269Z"
					fill="#E62058"
				/>
			</g>
			<defs>
				<clipPath id="flare-logo-clip">
					<rect width="99" height="35" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

const LINKS: Record<string, string> = {
	website: 'https://flare.network',
	docs: 'https://dev.flare.network',
	x: 'https://x.com/FlareNetworks',
	github: 'https://github.com/flare-foundation',
	explorer: 'https://flare-explorer.flare.network'
}

export default function FlareHeader() {
	return (
		<header className="flex items-center gap-4 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-4 py-2.5">
			<FlareLogo />
			<nav className="ml-auto flex items-center gap-0.5">
				{Object.entries(LINKS).map(([key, url]) => (
					<a
						key={key}
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className={`items-center gap-1.5 rounded-md px-2 py-1.5 body-md text-pro-text-secondary transition-colors hover:bg-sl-hover-bg hover:text-pro-text-primary ${
							key === 'website' ? 'flex' : 'hidden sm:flex'
						}`}
					>
						{LINK_ICONS[key]}
						<span className="hidden lg:inline">{LINK_LABELS[key]}</span>
					</a>
				))}
				<a
					href="https://flare.network"
					target="_blank"
					rel="noopener noreferrer"
					className="ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 title-md text-on-brand transition-opacity hover:opacity-85"
					style={{ background: 'linear-gradient(135deg, #FF7A1A, #E62058)' }}
				>
					Launch App
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
						<path d="M7 17L17 7M17 7H7M17 7v10" />
					</svg>
				</a>
			</nav>
		</header>
	)
}
