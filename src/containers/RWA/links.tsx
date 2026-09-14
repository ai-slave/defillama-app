import { ExternalLinkButton } from '~/components/ExternalLinkButton'

export const RWA_SUBMISSION_FORM_URL = 'https://forms.defillama.com/rwa-submission'

/** One component for the toolbar and the New listings card. */
export function RWAListYourAssetsButton({ className }: { className?: string }) {
	return (
		<ExternalLinkButton href={RWA_SUBMISSION_FORM_URL} icon="plus" className={className}>
			List Your Assets
		</ExternalLinkButton>
	)
}
