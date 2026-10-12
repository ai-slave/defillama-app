/**
 * The two public docs pages every exchanges surface points at, so nobody has to ask:
 * how the numbers are built, and how to get a venue listed.
 */
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'

export const EXCHANGES_METHODOLOGY_URL = 'https://docs.llama.fi/exchanges/methodology'
export const LIST_YOUR_EXCHANGE_URL = 'https://docs.llama.fi/exchanges/list-your-exchange'

/** Inline methodology link for the end of a tooltip or a short note. */
export function MethodologyLink() {
	return (
		<Button
			as={BasicLink}
			href={EXCHANGES_METHODOLOGY_URL}
			target="_blank"
			rel="noopener noreferrer"
			variant="inlineLink"
		>
			See the methodology
		</Button>
	)
}

/** Methodology and List-your-exchange buttons, side by side. */
export function ExchangeDocsLinks({ className = '' }: { className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
			<ExternalLinkButton href={EXCHANGES_METHODOLOGY_URL}>Methodology</ExternalLinkButton>
			<ExternalLinkButton href={LIST_YOUR_EXCHANGE_URL}>List your exchange</ExternalLinkButton>
		</div>
	)
}
