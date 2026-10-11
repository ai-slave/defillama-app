import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'
import { StaleText } from '~/ui/StaleText'
import { COPYRIGHT_YEAR } from '~/utils/copyrightYear'

/* ── Footer sub-components ──────────────────────────────────────────── */

// Each footer shows at one breakpoint only, so the icon size follows the breakpoint.
function SocialIcons() {
	return (
		<div className="flex items-center gap-2">
			<a
				href="https://discord.defillama.com"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="Discord"
				className="rounded-full p-1 text-tertiary"
			>
				<Icon name="discord" className="size-4.5 md:size-5" aria-hidden="true" />
			</a>
			<a
				href="https://twitter.com/DefiLlama"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="X/Twitter"
				className="rounded-full p-1 text-tertiary"
			>
				<Icon name="twitter" className="size-4.5 md:size-5" aria-hidden="true" />
			</a>
			<a
				href="https://github.com/DefiLlama"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="GitHub"
				className="rounded-full p-1 text-tertiary"
			>
				<Icon name="github" className="size-4.5 md:size-5" aria-hidden="true" />
			</a>
		</div>
	)
}

function FooterLinks() {
	return (
		<>
			<a href="mailto:support@defillama.com">Contact Us</a>
			<BasicLink href="/privacy-policy">Privacy Policy</BasicLink>
			<BasicLink href="/subscription/fulfillment-policies">Fulfillment Policies</BasicLink>
			<BasicLink href="/terms">Terms of Service</BasicLink>
		</>
	)
}

/* ── SubscriptionFooter ────────────────────────────────────────────── */

export function SubscriptionFooter() {
	return (
		<>
			{/* Mobile */}
			<footer className="px-4 pb-6 md:hidden">
				<div className="h-px w-full bg-border-subtle" />
				<div className="mt-6 flex items-center justify-between">
					<div className="flex flex-col items-start">
						<img
							src="/assets/defillama-dark-neutral.webp"
							alt="DefiLlama"
							className="h-7 w-[82px] object-contain object-left dark:hidden"
						/>
						<img
							src="/assets/defillama.webp"
							alt="DefiLlama"
							className="hidden h-7 w-[82px] object-contain object-left dark:block"
						/>
					</div>
					<SocialIcons />
				</div>
				<div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 body-xs text-secondary">
					<FooterLinks />
				</div>
				<StaleText as="p" className="mt-4 body-xs text-tertiary">
					{`© ${COPYRIGHT_YEAR} DefiLlama. All rights reserved.`}
				</StaleText>
			</footer>

			{/* Desktop */}
			<footer className="hidden px-32 pb-8 md:block">
				<div className="h-px w-full bg-border-subtle" />
				<div className="mt-8 flex flex-col gap-6">
					<div className="flex items-center justify-between">
						<div className="flex flex-col items-start">
							<img
								src="/assets/defillama-dark.webp"
								alt="DefiLlama"
								className="h-7 w-[83px] object-contain object-left dark:hidden"
							/>
							<img
								src="/assets/defillama.webp"
								alt="DefiLlama"
								className="hidden h-7 w-[83px] object-contain object-left dark:block"
							/>
						</div>
						<SocialIcons />
					</div>
					<div className="flex items-center justify-between body-sm text-tertiary">
						<StaleText as="p">{`© ${COPYRIGHT_YEAR} DefiLlama. All rights reserved.`}</StaleText>
						<div className="flex items-center gap-8 text-secondary">
							<FooterLinks />
						</div>
					</div>
				</div>
			</footer>
		</>
	)
}
