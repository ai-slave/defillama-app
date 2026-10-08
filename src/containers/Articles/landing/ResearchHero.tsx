import Link from 'next/link'
import React from 'react'
import { ResearchIcon } from '~/components/ResearchIcon'
import { ResearchSearchDialog } from '~/components/ResearchSearchDialog'
import { ReportsCarousel } from '~/containers/Articles/landing/ReportsCarousel'
import { ResearchHeaderWash } from '~/containers/Articles/ResearchHeaderWash'
import type { ArticleDocument } from '~/containers/Articles/types'

interface ResearchHeroProps {
	title: React.ReactNode
	subtitle: React.ReactNode
	reports: Array<ArticleDocument>
}

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
							<Link
								href="/newsletters"
								aria-label="Subscribe to DefiLlama newsletters"
								className="flex items-center gap-2 rounded-full bg-research-white px-3.5 py-3 body-lg text-research-accent-ink md:px-6 md:py-3.5"
							>
								<span>Subscribe</span>
								<ResearchIcon
									name="newsletter-mark"
									width={20}
									height={20}
									className="text-research-accent-ink"
									aria-hidden
								/>
							</Link>
							<a
								href="mailto:research@defillama.com"
								className="flex items-center rounded-full bg-research-white px-3.5 py-3 body-lg text-research-accent-ink md:px-6 md:py-3.5"
							>
								Contact us
							</a>
							<Link
								href="https://calendly.com/research-defillama/30min"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 rounded-full border border-research-white px-3.5 py-3 body-lg text-on-brand md:px-6 md:py-3.5"
							>
								<span>Book a call</span>

								<ResearchIcon name="calendly-mark" width={28} height={29} className="text-on-brand" aria-hidden />
							</Link>
						</div>

						<div className="flex gap-1.75">
							<Link
								href="https://x.com/defillama_res"
								aria-label="Follow us on X"
								rel="noopener noreferrer"
								target="_blank"
							>
								<ResearchIcon name="x-social" width={36} height={36} className="text-on-brand" aria-hidden />
							</Link>
							<Link
								href="https://t.me/defillama_research"
								aria-label="Follow us on Telegram"
								rel="noopener noreferrer"
								target="_blank"
							>
								<ResearchIcon name="telegram" width={36} height={36} className="text-on-brand" aria-hidden />
							</Link>
							<Link
								href="https://www.linkedin.com/company/defillama/"
								aria-label="Follow us on LinkedIn"
								rel="noopener noreferrer"
								target="_blank"
							>
								<ResearchIcon name="linkedin" width={36} height={36} className="text-on-brand" aria-hidden />
							</Link>
							<Link href="/research/feed" aria-label="Subscribe via RSS">
								<ResearchIcon name="rss" width={36} height={36} aria-hidden />
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
