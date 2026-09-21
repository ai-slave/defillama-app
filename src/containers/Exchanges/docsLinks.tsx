/**
 * The two public docs pages every exchanges surface points at, so nobody has to ask:
 * how the numbers are built, and how to get a venue listed.
 */
import { ExternalLinkButton } from '~/components/ExternalLinkButton'

export const EXCHANGES_METHODOLOGY_URL = 'https://docs.llama.fi/exchanges/methodology'
export const LIST_YOUR_EXCHANGE_URL = 'https://docs.llama.fi/exchanges/list-your-exchange'

/** Inline "Learn more" for the end of a tooltip or a short note. */
export function LearnMoreLink({ href = EXCHANGES_METHODOLOGY_URL }: { href?: string }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
			Learn more
		</a>
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
