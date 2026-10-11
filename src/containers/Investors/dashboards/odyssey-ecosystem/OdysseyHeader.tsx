import { Card } from '~/ui/Card'
import { tokenIconUrl } from '~/utils/icons'
import { type IrHeaderLink, IrHeaderLinks } from '../../IrHeaderLinks'
import { useTab, type MetadataResponse } from './api'

// llamaSlugs from /api/odyssey-ecosystem/metadata (protocols[].llamaSlug), used to pull protocol logos.
const ODYSSEY_SLUG = 'odyssey-finance'

// Live URLs come from metadata (links.* / debankBundles.*); static URLs are fallbacks until it loads.
function buildLinks(meta: MetadataResponse | undefined): Array<IrHeaderLink> {
	const links = meta?.links ?? {}
	const debank = meta?.debankBundles ?? {}
	return [
		{ label: 'Odyssey', href: links.odyssey ?? 'https://odyssey.finance', logo: tokenIconUrl(ODYSSEY_SLUG, 32) },
		{ label: 'Metronome', href: links.metronome ?? 'https://metronome.io', logo: tokenIconUrl('metronome-synth', 32) },
		{ label: 'Vesper', href: links.vesper ?? 'https://vesper.finance', logo: tokenIconUrl('vesper', 32) },
		{ label: 'Metronome Treasury', href: debank.metronome, icon: 'landmark' },
		{ label: 'Vesper Treasury', href: debank.vesper, icon: 'landmark' }
	]
}

export function OdysseyIcon({ className = 'size-7' }: { className?: string }) {
	return (
		<img
			src={tokenIconUrl(ODYSSEY_SLUG, 64)}
			alt="Odyssey Finance"
			className={`${className} rounded-full bg-surface object-contain`}
		/>
	)
}

function OdysseyLogo() {
	return (
		<div className="flex items-center gap-2.5">
			<OdysseyIcon className="size-7 shrink-0" />
			<span className="heading-xs text-primary">Odyssey Ecosystem</span>
		</div>
	)
}

export default function OdysseyHeader() {
	const { data: meta } = useTab<MetadataResponse>('metadata')
	return (
		<Card as="header" padding="strip" className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<OdysseyLogo />
			<IrHeaderLinks links={buildLinks(meta)} />
		</Card>
	)
}
