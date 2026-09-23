import { formatDate } from '~/utils/dateFormat'
import { useKpkMetadata, type KpkLinkKey } from './api'

const LINK_LABELS: Record<KpkLinkKey, string> = {
	website: 'kpk.io',
	docs: 'Docs',
	app: 'App',
	x: 'X',
	github: 'GitHub'
}

const LINK_ORDER: Array<KpkLinkKey> = ['website', 'app', 'docs', 'x', 'github']

export default function KpkHeader() {
	const { data } = useKpkMetadata()
	const asOf = data?.asOf ? formatDate(data.asOf) : null

	return (
		<header className="flex flex-col gap-2.5 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-4 py-3">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<span className="text-lg font-semibold tracking-[0.14em] text-pro-text-primary">KPK</span>
				<span className="label-sm tracking-[0.13em] text-pro-text-label uppercase">
					{data?.tagline ?? 'Investor relations'}
				</span>
				<nav className="ml-auto flex flex-wrap items-center gap-1">
					{LINK_ORDER.map((key) => {
						const url = data?.links?.[key]
						if (!url) return null
						return (
							<a
								key={key}
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-full border border-pro-cards-border px-2.5 py-1 label-sm text-pro-text-secondary transition-colors hover:border-sl-accent hover:text-pro-text-primary"
							>
								{LINK_LABELS[key]}
							</a>
						)
					})}
				</nav>
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 body-sm text-pro-text-tertiary">
				{asOf && <span>Data as of {asOf}</span>}
				{data?.notes?.map((note) => (
					<span key={note}>{note}</span>
				))}
			</div>
		</header>
	)
}
