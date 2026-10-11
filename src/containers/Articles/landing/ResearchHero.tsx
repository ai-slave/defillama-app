import Link from 'next/link'
import React from 'react'
import { ResearchSearchDialog } from '~/components/ResearchSearchDialog'
import { ReportsCarousel } from '~/containers/Articles/landing/ReportsCarousel'
import { ResearchPill } from '~/containers/Articles/landing/ResearchPill'
import { ResearchHeaderWash } from '~/containers/Articles/ResearchHeaderWash'
import type { ArticleDocument } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'

interface ResearchHeroProps {
	title: React.ReactNode
	subtitle: React.ReactNode
	reports: Array<ArticleDocument>
}

// The social links are white discs with the logo in banner ink, matching the white pills beside them.
const socialClassName =
	'flex size-9 items-center justify-center rounded-full bg-research-white text-research-accent-ink'

export function ResearchHero({ title, subtitle, reports }: ResearchHeroProps) {
	return (
		<div className="text-on-brand">
			<div>
				<div className="relative isolate flex flex-col items-center pt-8 lg:pt-11.25">
					<div className="absolute inset-x-0 top-2 z-10 mx-auto hidden w-full max-w-7xl justify-end px-8 lg:flex">
						<ResearchSearchDialog variant="desktop" />
					</div>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+clamp(160px,18vw,200px))] overflow-hidden select-none"
					>
						<ResearchHeaderWash />
					</div>
					<img src="/assets/research_logo_dark.webp" alt="DefiLlama" width={229} height={72} />
					<h1 className="mt-8.75 mb-3 text-center text-[22px] leading-[130%] font-semibold lg:mb-4 lg:text-[32px]">
						{title}
					</h1>
					<h2 className="mb-6 text-center text-base leading-[130%] font-light lg:mb-8.75 lg:text-xl">{subtitle}</h2>

					<div className="flex flex-col items-center gap-9 lg:flex-row">
						<div className="flex flex-wrap justify-center gap-3">
							<ResearchPill
								as={Link}
								href="/newsletters"
								aria-label="Subscribe to DefiLlama newsletters"
								tone="white"
								size="lg"
							>
								<span>Subscribe</span>
								<Icon name="mail" className="size-5" aria-hidden />
							</ResearchPill>
							<ResearchPill as="a" href="mailto:research@defillama.com" tone="white" size="lg">
								Contact us
							</ResearchPill>
							<ResearchPill
								as={Link}
								href="https://calendly.com/research-defillama/30min"
								target="_blank"
								rel="noopener noreferrer"
								tone="whiteOutline"
								size="lg"
							>
								<span>Book a call</span>
								<Icon name="calendly" className="size-5" aria-hidden />
							</ResearchPill>
						</div>

						<div className="flex gap-1.75">
							<Link
								href="https://x.com/defillama_res"
								aria-label="Follow us on X"
								rel="noopener noreferrer"
								target="_blank"
								className={socialClassName}
							>
								<Icon name="twitter" className="size-5" aria-hidden />
							</Link>
							<Link
								href="https://t.me/defillama_research"
								aria-label="Follow us on Telegram"
								rel="noopener noreferrer"
								target="_blank"
								className={socialClassName}
							>
								<Icon name="telegram-plane" className="size-5" aria-hidden />
							</Link>
							<Link
								href="https://www.linkedin.com/company/defillama/"
								aria-label="Follow us on LinkedIn"
								rel="noopener noreferrer"
								target="_blank"
								className={socialClassName}
							>
								<Icon name="linkedin-in" className="size-5" aria-hidden />
							</Link>
							<Link href="/research/feed" aria-label="Subscribe via RSS" className={socialClassName}>
								<Icon name="rss" className="size-5" aria-hidden />
							</Link>
						</div>
					</div>
				</div>

				{reports.length > 0 ? (
					<div className="mt-11.25 mb-8 w-full pb-6">
						<ReportsCarousel reports={reports} showButtons={false} />
					</div>
				) : null}
			</div>
		</div>
	)
}
