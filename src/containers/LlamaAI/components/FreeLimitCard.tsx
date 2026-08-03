import { BasicLink } from '~/components/Link'
import type { FreeLimitOffer } from '~/containers/LlamaAI/types'
import { Icon } from '~/ui/Icon'

export function FreeLimitCard({ offer }: { offer: FreeLimitOffer }) {
	return (
		<div className="relative my-2.5 w-full overflow-hidden rounded-xl border border-sub-brand-primary/25 bg-ai-white p-5 dark:border-sub-brand-primary/35 dark:bg-sub-surface-dark">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 bg-linear-to-br from-sub-brand-primary/10 via-transparent to-sub-purple/10 dark:from-sub-brand-primary/15 dark:to-sub-purple/10"
			/>
			<div className="relative flex items-start gap-3">
				<img
					src="/assets/app/app-icon.png"
					alt=""
					width={44}
					height={44}
					className="size-11 shrink-0 rounded-xl shadow-sub-blue-glow"
				/>
				<div className="min-w-0">
					<span className="text-[11px] font-semibold tracking-wider text-sub-brand-primary uppercase dark:text-sub-brand-softest">
						DefiLlama App
					</span>
					<h3 className="mt-1 text-xl leading-7 font-semibold text-sub-text-primary">Keep asking LlamaAI for free</h3>
					<p className="mt-1.5 text-[13px] leading-5 text-sub-text-secondary dark:text-sub-text-muted">
						Get extra free LlamaAI queries in the DefiLlama App, available on iOS and Android.
					</p>
				</div>
			</div>

			<BasicLink
				href="/app"
				data-umami-event="mobile-app-free-limit-click"
				data-umami-event-limit={offer.code}
				className="group/cta relative mt-5 flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-sub-brand-primary text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
			>
				Get the DefiLlama App
				<Icon
					name="arrow-right"
					height={16}
					width={16}
					className="transition-transform group-hover/cta:translate-x-0.5"
				/>
			</BasicLink>

			<p className="relative mt-3 text-center text-xs text-sub-text-muted">
				Need unlimited questions?{' '}
				<BasicLink
					href="/subscription"
					data-umami-event="llamaai-free-limit-pro-click"
					data-umami-event-limit={offer.code}
					className="font-medium text-sub-brand-primary underline underline-offset-2 dark:text-sub-brand-softest"
				>
					Explore DefiLlama Pro
				</BasicLink>
			</p>
		</div>
	)
}
