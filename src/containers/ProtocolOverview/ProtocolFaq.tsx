import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import type { IProtocolFaqItem } from './types'

const DEFAULT_OPEN_COUNT = 5

export function ProtocolFaq({ items }: { items: Array<IProtocolFaqItem> }) {
	if (items.length === 0) return null

	return (
		<Card as="section" padding="none" aria-labelledby="protocol-faq-heading" className="overflow-hidden">
			<h2 id="protocol-faq-heading" className="border-b border-subtle px-3 py-3 heading-xs sm:px-4">
				Frequently asked questions
			</h2>
			<div>
				{items.map((item, index) => (
					<details
						key={item.id}
						open={index < DEFAULT_OPEN_COUNT}
						className="group smooth-disclosure border-b border-subtle last:border-b-0"
					>
						<summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-3.5 transition-colors group-open:pb-2.5 marker:hidden hover:bg-hover-row sm:px-4">
							<span className="min-w-0 flex-1 label-lg text-primary">{item.question}</span>
							<Icon
								name="chevron-down"
								className="size-4 shrink-0 text-tertiary transition-transform duration-100 group-open:rotate-180"
							/>
						</summary>
						<p className="max-w-3xl px-3 pb-3.5 body-md text-secondary sm:px-4">
							{item.answer.map((part, partIndex) =>
								part.href ? (
									<Button
										as={BasicLink}
										// oxlint-disable-next-line react/no-array-index-key -- Answer fragments are positional prose; text and links can repeat.
										key={`${item.id}-${partIndex}`}
										href={part.href}
										variant="inlineLink"
									>
										{part.text}
									</Button>
								) : (
									// oxlint-disable-next-line react/no-array-index-key -- Answer fragments are positional prose; text and links can repeat.
									<span key={`${item.id}-${partIndex}`}>{part.text}</span>
								)
							)}
						</p>
					</details>
				))}
			</div>
		</Card>
	)
}
