import { useQuery } from '@tanstack/react-query'
import { readInvestorApiJson } from '../../api.types'
import { UniswapLogo } from './UniswapLogo'

interface Metadata {
	projectName: string
	links: Partial<Record<'website' | 'app' | 'docs' | 'governance' | 'x' | 'github', string>>
}

const LINK_LABELS: Record<string, string> = { x: 'X', docs: 'Docs', governance: 'Governance' }

const LINK_ICONS: Record<string, React.ReactNode> = {
	x: (
		<svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	),
	docs: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	),
	governance: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<path d="M12 3 3 8h18l-9-5Z" strokeLinejoin="round" />
			<path d="M5 8v8M9.5 8v8M14.5 8v8M19 8v8M3 20h18" strokeLinecap="round" />
		</svg>
	)
}

export default function UniswapHeader() {
	const { data } = useQuery<Metadata>({
		queryKey: ['uniswap', 'metadata'],
		queryFn: async () => {
			const res = await fetch('/api/public/uniswap/metadata')
			if (!res.ok) throw new Error(`Uniswap metadata error: ${res.status}`)
			return readInvestorApiJson<Metadata>(res)
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const links = data?.links ?? {}

	return (
		<header className="flex items-center gap-3 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-4 py-2.5">
			<UniswapLogo />
			<div className="leading-tight">
				<span className="text-sm font-semibold text-pro-text-primary">{data?.projectName ?? 'Uniswap'}</span>
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
							className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-pro-text-secondary transition-colors hover:bg-sl-hover-bg hover:text-pro-text-primary sm:flex"
						>
							{LINK_ICONS[key]}
							<span className="hidden lg:inline">{label}</span>
						</a>
					)
				})}
				{links.app && (
					<a
						href={links.app}
						target="_blank"
						rel="noopener noreferrer"
						className="ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-on-brand transition-opacity hover:opacity-85"
						style={{ background: 'linear-gradient(135deg, #FF007A, #FC72FF)' }}
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
