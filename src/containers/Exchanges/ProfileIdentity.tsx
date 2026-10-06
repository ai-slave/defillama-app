import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { letterLogoDataUri } from '~/utils/icons'
import type { ExchangeProfileModel } from './models'
import { selectVenueDestination } from './venueLinks'

export function ProfileIdentity({ profile }: { profile: ExchangeProfileModel }) {
	const venueDestination = selectVenueDestination(profile.slug, profile.metadata.referralUrl, profile.metadata.website)
	return (
		<h1 className="flex flex-wrap items-center gap-2 heading-sm">
			<TokenLogo
				name={profile.slug}
				kind="exchange"
				size={24}
				fallbackSrc={letterLogoDataUri(profile.name)}
				alt={`${profile.name} logo`}
			/>
			<span>{profile.name}</span>
			<Tag>{profile.kind.toUpperCase()}</Tag>
			<span className="-m-2 ml-auto flex items-center justify-end gap-1">
				{venueDestination ? (
					<Tooltip
						content={`Open ${profile.name} website`}
						render={
							<Button
								as="a"
								variant="ghost"
								size="md"
								square
								href={venueDestination.url}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Open ${profile.name} website`}
								data-umami-event="exchange-website-click"
								data-umami-event-exchange={profile.name}
								data-umami-event-referral={venueDestination.kind === 'referral' ? 'true' : 'false'}
								data-umami-event-url={venueDestination.url}
							/>
						}
					>
						<Icon name="globe" className="size-4" />
					</Tooltip>
				) : null}
				{profile.metadata.twitterUrl ? (
					<Tooltip
						content={`Open ${profile.name} on X`}
						render={
							<Button
								as="a"
								variant="ghost"
								size="md"
								square
								href={profile.metadata.twitterUrl}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={`Open ${profile.name} on X`}
								data-umami-event="exchange-twitter-click"
								data-umami-event-exchange={profile.name}
								data-umami-event-url={profile.metadata.twitterUrl}
							/>
						}
					>
						<Icon name="twitter" className="size-4" />
					</Tooltip>
				) : null}
			</span>
		</h1>
	)
}
