import { useQuery } from '@tanstack/react-query'

interface Metadata {
	projectName: string
	token: { symbol: string }
	links: Partial<Record<'website' | 'docs' | 'x' | 'explorer' | 'data', string>>
	launchUrl?: string
}

const LINK_LABELS: Record<string, string> = { x: 'X', explorer: 'Explorer' }

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
	explorer: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<circle cx="11" cy="11" r="8" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
	),
	data: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<ellipse cx="12" cy="5" rx="9" ry="3" />
			<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
		</svg>
	)
}

export default function ThorchainHeader() {
	const { data } = useQuery<Metadata>({
		queryKey: ['thorchain-metadata'],
		queryFn: async () => {
			const res = await fetch('/api/public/thorchain/metadata')
			if (!res.ok) throw new Error(`THORChain metadata error: ${res.status}`)
			return res.json()
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const links = data?.links ?? {}

	return (
		<header className="flex items-center gap-3 rounded-lg border border-(--legacy-cards-border) bg-(--legacy-cards-bg) px-4 py-2.5">
			{/* RUNE token mark, inlined so the dashboard owns it (no asset file dependency). */}
			<svg viewBox="0 0 300 300" role="img" aria-label="THORChain" className="size-8 shrink-0">
				<circle cx="150" cy="150" r="150" fill="url(#rune-logo)" />
				<path
					d="M54 265L207.721 197.386L159.058 145.843L54 265ZM110.471 94.3804L159.134 145.843L246 35L110.471 94.3804Z"
					fill="white"
				/>
				<defs>
					<linearGradient id="rune-logo" x1="300" y1="150.23" x2="0" y2="150.23" gradientUnits="userSpaceOnUse">
						<stop stopColor="#33FF99" />
						<stop offset="1" stopColor="#00CCFF" />
					</linearGradient>
				</defs>
			</svg>
			<div className="leading-tight">
				<span className="text-sm font-semibold text-(--legacy-text-primary)">{data?.projectName ?? 'THORChain'}</span>
			</div>
			<nav className="ml-auto flex items-center gap-0.5">
				{Object.entries(LINK_LABELS).map(([key, label]) => {
					const url = links[key as keyof typeof links]
					if (!url) return null
					return (
						<a
							key={key}
							href={url}
							target="_blank"
							rel="noopener noreferrer"
							className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-(--legacy-text-secondary) transition-colors hover:bg-(--sl-hover-bg) hover:text-(--legacy-text-primary) sm:flex"
						>
							{LINK_ICONS[key]}
							<span className="hidden lg:inline">{label}</span>
						</a>
					)
				})}
				{data?.launchUrl && (
					<a
						href={data.launchUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-85"
						style={{ background: 'linear-gradient(135deg, #00CCFF, #31FD9D)' }}
					>
						Launch App
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
							<path d="M7 17L17 7M17 7H7M17 7v10" />
						</svg>
					</a>
				)}
			</nav>
		</header>
	)
}
