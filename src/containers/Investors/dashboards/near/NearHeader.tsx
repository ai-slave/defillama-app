import { Card } from '~/ui/Card'
import { type IrHeaderLink, IrHeaderLinks } from '../../IrHeaderLinks'
import { NearIcon } from './NearIcon'

function NearLogo() {
	return (
		<div className="flex items-center gap-2.5">
			<NearIcon className="size-7 shrink-0" />
			<span className="heading-xs text-primary">NEAR Protocol</span>
		</div>
	)
}

const LINKS: ReadonlyArray<IrHeaderLink> = [
	{ label: 'Website', href: 'https://near.org', icon: 'globe' },
	{ label: 'Docs', href: 'https://docs.near.org', icon: 'file-text' },
	{ label: 'X', href: 'https://x.com/nearprotocol', icon: 'twitter' },
	{ label: 'GitHub', href: 'https://github.com/near', icon: 'github' },
	{ label: 'Explorer', href: 'https://nearblocks.io', icon: 'search' }
]

export default function NearHeader() {
	return (
		<Card as="header" padding="strip" className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<NearLogo />
			<IrHeaderLinks
				links={LINKS}
				launch={{
					label: 'Visit NEAR',
					href: 'https://near.org',
					background: 'linear-gradient(135deg, #00C1DE, #00E4AA)'
				}}
			/>
		</Card>
	)
}
