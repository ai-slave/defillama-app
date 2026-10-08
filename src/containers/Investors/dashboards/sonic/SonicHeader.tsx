import { SonicIcon } from './SonicIcon'

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
	feem: (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0">
			<circle cx="12" cy="12" r="10" />
			<path d="M12 6v12M8 10h8M8 14h6" />
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
	feem: 'FeeM',
	explorer: 'Explorer'
}

function SonicLogo() {
	return (
		<div className="flex items-center gap-2.5">
			<SonicIcon className="size-7 shrink-0" />
			<span className="heading-xs text-pro-text-primary">Sonic</span>
		</div>
	)
}

const LINKS: Record<string, string> = {
	website: 'https://soniclabs.com',
	docs: 'https://docs.soniclabs.com',
	x: 'https://x.com/SonicLabs',
	feem: 'https://feem.soniclabs.com/',
	explorer: 'https://sonicscan.org'
}

export default function SonicHeader() {
	return (
		<header className="flex items-center gap-4 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-4 py-2.5">
			<SonicLogo />
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
					href="https://soniclabs.com"
					target="_blank"
					rel="noopener noreferrer"
					className="ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 title-md text-on-brand transition-opacity hover:opacity-85"
					style={{ background: 'linear-gradient(135deg, #1E90FF, #00BFFF)' }}
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
