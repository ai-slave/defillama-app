import { useState } from 'react'
import type { FaqItem } from '~/containers/Subscription/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

function FaqAnswer({ text, onStartTrial }: { text: string; onStartTrial?: () => void }) {
	const phrase = '7-day free trials'
	const idx = text.indexOf(phrase)
	if (idx === -1 || !onStartTrial) return <>{text}</>

	return (
		<>
			{text.slice(0, idx)}
			<Button variant="inlineLink" onClick={onStartTrial}>
				{phrase}
			</Button>
			{text.slice(idx + phrase.length)}
		</>
	)
}

export function SubscriptionFaqBlock({
	faqItems,
	onStartTrial
}: {
	faqItems: Array<FaqItem>
	onStartTrial?: () => void
}) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

	return (
		<div className="mt-16 w-full md:mt-12 md:w-[384px]">
			<h2 className="text-center heading-sm text-primary">Frequently asked questions</h2>
			<div className="mt-7 md:mt-9 md:flex md:flex-col md:gap-4">
				{faqItems.map((item, index) => {
					const questionId = `subscription-faq-question-${index}`
					const answerId = `subscription-faq-answer-${index}`
					const isExpanded = expandedIndex === index

					return (
						<div
							// oxlint-disable-next-line react/no-array-index-key -- The authored FAQ order is fixed; expansion and aria IDs use these slots.
							key={index}
							className="border-b border-subtle py-4 md:py-0 md:pb-4"
						>
							<button
								type="button"
								id={questionId}
								aria-expanded={isExpanded}
								aria-controls={answerId}
								onClick={() => setExpandedIndex(isExpanded ? null : index)}
								className="flex w-full items-center justify-between gap-4 text-left"
							>
								<p className="label-lg text-primary md:label-md">{item.question}</p>
								<Icon name={isExpanded ? 'x' : 'plus'} className="size-4.5 shrink-0 text-primary" />
							</button>
							<div
								id={answerId}
								role="region"
								aria-labelledby={questionId}
								className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
							>
								<div className="overflow-hidden">
									<p className="pt-2 body-md text-secondary">
										<FaqAnswer text={item.answer} onStartTrial={onStartTrial} />
									</p>
								</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
