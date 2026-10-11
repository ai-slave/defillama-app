import { Card } from '~/ui/Card'
import { type IrHeaderLink, IrHeaderLinks } from '../../IrHeaderLinks'
import { SonicIcon } from './SonicIcon'

function SonicLogo() {
	return (
		<div className="flex items-center gap-2.5">
			<SonicIcon className="size-7 shrink-0" />
			<span className="heading-xs text-primary">Sonic</span>
		</div>
	)
}

const LINKS: ReadonlyArray<IrHeaderLink> = [
	{ label: 'Website', href: 'https://soniclabs.com', icon: 'globe' },
	{ label: 'Docs', href: 'https://docs.soniclabs.com', icon: 'file-text' },
	{ label: 'X', href: 'https://x.com/SonicLabs', icon: 'twitter' },
	{ label: 'FeeM', href: 'https://feem.soniclabs.com/', icon: 'coins' },
	{ label: 'Explorer', href: 'https://sonicscan.org', icon: 'search' }
]

export default function SonicHeader() {
	return (
		<Card as="header" padding="strip" className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<SonicLogo />
			<IrHeaderLinks
				links={LINKS}
				launch={{
					label: 'Launch App',
					href: 'https://soniclabs.com',
					background: 'linear-gradient(135deg, #1E90FF, #00BFFF)'
				}}
			/>
		</Card>
	)
}
