import { TokenLogo } from '~/components/TokenLogo'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { letterLogoDataUri } from '~/utils/icons'
import type { ExchangeProfileModel } from './models'
import { selectVenueDestination } from './venueLinks'

export function ProfileIdentity({ profile }: { profile: ExchangeProfileModel }) {
	const venueDestination = selectVenueDestination(profile.slug, profile.metadata.referralUrl, profile.metadata.website)
	return (
		<h1 className="flex flex-wrap items-center gap-2 heading-sm">
			<TokenLogo
				name={profile.name}
				kind="token"
				size={24}
				fallbackSrc={letterLogoDataUri(profile.name)}
				alt={`${profile.name} logo`}
			/>
			<span>{profile.name}</span>
			<span className="rounded-sm border border-subtle px-1.5 py-0.5 label-sm uppercase">{profile.kind}</span>
			<span className="-m-2 ml-auto flex items-center justify-end gap-1">
				{venueDestination ? (
					<Tooltip content={`Open ${profile.name} website`}>
						<a
							href={venueDestination.url}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={`Open ${profile.name} website`}
							data-umami-event="exchange-website-click"
							data-umami-event-exchange={profile.name}
							data-umami-event-referral={venueDestination.kind === 'referral' ? 'true' : 'false'}
							data-umami-event-url={venueDestination.url}
							className={buttonStyles({ variant: 'ghost', size: 'md', square: true })}
						>
							<Icon name="globe" className="size-4" />
						</a>
					</Tooltip>
				) : null}
			</span>
		</h1>
	)
}
