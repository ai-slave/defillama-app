import Link from 'next/link'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { RESEARCH_FEED_URL } from '~/containers/Articles/researchFeed'
import { useCopy } from '~/ui/Copy'
import { Icon } from '~/ui/Icon'
import { feedSchemeUrl } from './readers'
import { RssMark } from './RssMark'

export type ResearchFeedPreviewItem = {
	title: string
	href: string
	sectionLabel: string
	date: string
}

const REVEAL_STYLES = `
@keyframes dlFeedReveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes dlFeedPulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(2.6); opacity: 0; } }
@keyframes dlFeedPing { from { transform: scale(0.12); opacity: 0.32; } to { transform: scale(1); opacity: 0; } }
.dl-feed-reveal { animation: dlFeedReveal 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
.dl-feed-pulse { animation: dlFeedPulse 2s ease-out infinite; }
.dl-feed-ping { transform-box: fill-box; transform-origin: center; animation: dlFeedPing 6s cubic-bezier(0.16, 1, 0.3, 1) infinite both; }
@media (prefers-reduced-motion: reduce) { .dl-feed-reveal, .dl-feed-pulse { animation: none; } .dl-feed-ping { display: none; } }
`

function CopyFeedUrlButton({ value }: { value: string }) {
	const { copied, copy } = useCopy()
	return (
		<>
			<button
				type="button"
				onClick={() => void copy(value)}
				aria-label="Copy feed URL"
				className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-research-live px-5 py-2.5 label-md text-research-heading transition-[background-color,transform] duration-150 hover:bg-research-live/90 motion-safe:active:scale-[0.97] sm:w-auto"
			>
				<Icon name={copied ? 'check' : 'copy'} height={15} width={15} />
				{copied ? 'Copied' : 'Copy'}
			</button>
			<span role="status" className="sr-only">
				{copied ? 'Feed URL copied' : ''}
			</span>
		</>
	)
}

function RssCornerMotif() {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute -top-6 right-0 z-0 hidden size-[clamp(320px,30vw,460px)] lg:block"
		>
			<svg viewBox="0 0 200 200" className="size-full">
				<g fill="none" stroke="#ee802f" strokeWidth="2.2">
					<circle cx="188" cy="12" r="54" strokeOpacity="0.4" />
					<circle cx="188" cy="12" r="100" strokeOpacity="0.26" />
					<circle cx="188" cy="12" r="146" strokeOpacity="0.16" />
					<circle cx="188" cy="12" r="192" strokeOpacity="0.09" />
				</g>
				<circle className="dl-feed-ping" cx="188" cy="12" r="160" fill="none" stroke="#ee802f" strokeWidth="2" />
				<circle
					className="dl-feed-ping"
					style={{ animationDelay: '3s' }}
					cx="188"
					cy="12"
					r="160"
					fill="none"
					stroke="#ee802f"
					strokeWidth="2"
				/>
				<circle cx="188" cy="12" r="11" fill="#ee802f" />
			</svg>
		</div>
	)
}

export function ResearchFeedLanding({ items }: { items: Array<ResearchFeedPreviewItem> }) {
	const hasPreview = items.length > 0
	return (
		<>
			<style>{REVEAL_STYLES}</style>

			<div className="mx-auto max-w-6xl px-4 py-12 text-primary sm:px-6 lg:px-8 lg:py-16">
				<div className="relative overflow-hidden">
					<RssCornerMotif />

					<div className="relative z-10">
						<div className="dl-feed-reveal flex items-center gap-2.5">
							<RssMark size={18} />
							<span className="label-xs tracking-[0.22em] text-tertiary uppercase">Web feed</span>
						</div>
						<h1
							className="dl-feed-reveal mt-5 max-w-3xl heading-lg tracking-[-0.03em] text-balance"
							style={{ animationDelay: '40ms' }}
						>
							Every report, the moment it ships.
						</h1>
						<p
							className="dl-feed-reveal mt-5 max-w-2xl body-lg text-secondary lg:body-xl"
							style={{ animationDelay: '90ms' }}
						>
							Data-driven crypto and digital-asset research: market analysis, interviews, and reports, delivered to your
							feed reader the moment we publish.
						</p>

						<div
							className="dl-feed-reveal mt-9 flex max-w-2xl flex-col gap-3 rounded-xl bg-research-heading p-3 ring-1 ring-research-white/10 ring-inset sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pr-3 sm:pl-5"
							style={{ animationDelay: '140ms' }}
						>
							<span className="flex min-w-0 flex-1 items-center gap-3">
								<span className="relative flex size-2.5 shrink-0 items-center justify-center">
									<span className="dl-feed-pulse absolute inline-flex size-full rounded-full bg-research-live" />
									<span className="relative inline-flex size-2.5 rounded-full bg-research-live" />
								</span>
								<code className="truncate mono-md text-on-brand">{RESEARCH_FEED_URL}</code>
							</span>
							<CopyFeedUrlButton value={RESEARCH_FEED_URL} />
						</div>

						<div className="dl-feed-reveal mt-8" style={{ animationDelay: '190ms' }}>
							<a
								href={feedSchemeUrl(RESEARCH_FEED_URL)}
								className="inline-flex items-center gap-2.5 rounded-lg border border-medium px-5 py-2.5 title-md text-primary transition-[color,background-color,border-color,transform] duration-150 hover:border-link/50 hover:bg-surface motion-safe:active:scale-[0.98]"
							>
								<RssMark size={16} />
								Open in your RSS app
							</a>
							<p className="mt-4 max-w-xl body-md text-tertiary">
								Works with any reader: NetNewsWire, Reeder, Readwise Reader, Feedly, and more. Or paste the URL above
								into the app you already use.
							</p>
						</div>
					</div>
				</div>

				{hasPreview ? (
					<div className="mt-14">
						<TitleLine title="Latest" />
						<ul className="mt-6 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
							{items.map((item) => (
								<li key={item.href} className="border-b border-medium">
									<Link href={item.href} className="group block py-4">
										<span className="label-xs tracking-[0.18em] uppercase">
											<span className="text-link">{item.sectionLabel}</span>{' '}
											<span className="text-tertiary">· {item.date}</span>
										</span>
										<span className="mt-1.5 block title-md text-primary transition-colors group-hover:text-link">
											{item.title}
										</span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				) : null}

				<div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-medium pt-6 label-xs tracking-[0.14em] text-tertiary uppercase">
					<a
						href="/research/feed.xml"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 transition-colors hover:text-secondary"
					>
						View raw XML <Icon name="arrow-up-right" height={12} width={12} />
					</a>
				</div>
			</div>
			<ResearchFooter maxWidthClassName="max-w-6xl" />
		</>
	)
}
