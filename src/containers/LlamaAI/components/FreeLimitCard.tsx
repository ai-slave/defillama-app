import { BasicLink } from '~/components/Link'
import type { FreeLimitOffer } from '~/containers/LlamaAI/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

export function FreeLimitCard({ offer }: { offer: FreeLimitOffer }) {
	return (
		<div className="my-2.5 flex w-full flex-col gap-4 rounded-lg border border-subtle bg-surface p-4">
			<div className="flex items-start gap-3">
				<img src="/assets/app/app-icon.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
				<div className="min-w-0">
					<span className="label-xs tracking-wide text-link uppercase">DefiLlama App</span>
					<h3 className="mt-1 heading-xs text-primary">Keep asking LlamaAI for free</h3>
					<p className="mt-1 body-sm text-secondary">
						Get extra free LlamaAI queries in the DefiLlama App, available on iOS and Android.
					</p>
				</div>
			</div>

			<Button
				as={BasicLink}
				href="/app"
				data-umami-event="mobile-app-free-limit-click"
				data-umami-event-limit={offer.code}
				size="md"
				variant="primary"
				className="w-full"
			>
				Get the DefiLlama App
				<Icon name="arrow-right" height={14} width={14} />
			</Button>

			<p className="text-center body-sm text-tertiary">
				Need unlimited questions?{' '}
				<BasicLink
					href="/subscription"
					data-umami-event="llamaai-free-limit-pro-click"
					data-umami-event-limit={offer.code}
					className="font-medium text-link hover:underline"
				>
					Explore DefiLlama Pro
				</BasicLink>
			</p>
		</div>
	)
}
