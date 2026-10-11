import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Card } from '~/ui/Card'
import { formatDate } from '~/utils/dateFormat'
import { useTab, type KpkLinkKey, type KpkMetadata } from './api'

const LINK_LABELS: Record<KpkLinkKey, string> = {
	website: 'kpk.io',
	docs: 'Docs',
	app: 'App',
	x: 'X',
	github: 'GitHub'
}

const LINK_ORDER: Array<KpkLinkKey> = ['website', 'app', 'docs', 'x', 'github']

export default function KpkHeader() {
	const { data } = useTab<KpkMetadata>('metadata')
	const asOf = data?.asOf ? formatDate(data.asOf) : null

	return (
		<Card as="header" padding="strip" className="flex flex-col gap-2.5">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<span className="heading-xs tracking-[0.14em] text-primary">KPK</span>
				<span className="label-sm tracking-[0.13em] text-secondary uppercase">
					{data?.tagline ?? 'Investor relations'}
				</span>
				<nav className="ml-auto flex flex-wrap items-center gap-1">
					{LINK_ORDER.map((key) => {
						const url = data?.links?.[key]
						if (!url) return null
						return (
							<ExternalLinkButton key={key} href={url}>
								{LINK_LABELS[key]}
							</ExternalLinkButton>
						)
					})}
				</nav>
			</div>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 body-sm text-tertiary">
				{asOf && <span>Data as of {asOf}</span>}
				{data?.notes?.map((note) => (
					<span key={note}>{note}</span>
				))}
			</div>
		</Card>
	)
}
