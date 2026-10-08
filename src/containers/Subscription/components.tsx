import { END_TRIAL_APPLYING_REASON, useEndTrialApplying } from '~/containers/Account/endTrialHold'
import { PRO_TRIAL_CONVERSION_PRICE } from '~/containers/Subscription/data'
import type {
	Availability,
	BillingCycle,
	FeatureItem,
	PlanKey,
	PricingCardCallbacks,
	PricingCardData
} from '~/containers/Subscription/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { CoveragePricingContent } from './sections/SubscriptionCoverage'

const PLAN_TIER: Record<PlanKey, number> = { free: 0, pro: 1, api: 2, enterprise: 3 }

/* ── Style maps ─────────────────────────────────────────────────────── */

const cardWrapperStyles = {
	highlighted:
		'w-full flex-[1_1_280px] flex flex-col gap-2.5 rounded-[24px] bg-sub-brand-primary px-0.5 pt-0.5 pb-3 sm:max-w-[330px]',
	default: 'w-full flex-[1_1_280px] flex flex-col sm:max-w-[330px] sm:gap-2.5 sm:pb-3'
}

const cardShellStyles = {
	highlighted: 'relative flex flex-1 flex-col',
	default:
		'relative flex flex-1 flex-col rounded-[24px] border border-sub-border-slate-100 bg-white dark:border-sub-border-strong dark:bg-sub-surface-dark'
}

const cardInnerStyles = {
	highlighted:
		'flex h-full flex-1 flex-col justify-between overflow-hidden rounded-[22px] bg-white px-5 py-6 dark:bg-sub-surface-dark sm:px-4',
	default:
		'flex h-full flex-1 flex-col justify-between overflow-hidden rounded-[24px] bg-white px-5 py-6 dark:bg-sub-surface-dark sm:px-4'
}

export const SELECTED_COLUMN_HIGHLIGHT = 'bg-brand/6 dark:bg-sub-brand-primary/5'

const selectedColumnStyles = {
	active: SELECTED_COLUMN_HIGHLIGHT,
	inactive: ''
}

/* ── Shared helpers ─────────────────────────────────────────────────── */

function FeatureLabel({ item }: { item: FeatureItem }) {
	if (item.link && item.linkText) {
		const idx = item.label.indexOf(item.linkText)
		if (idx !== -1) {
			return (
				<>
					{item.label.slice(0, idx)}
					<a href={item.link} className="underline">
						{item.linkText}
					</a>
					{item.label.slice(idx + item.linkText.length)}
				</>
			)
		}
	}
	if (item.link) {
		return (
			<a href={item.link} className="underline">
				{item.label}
			</a>
		)
	}
	return <>{item.label}</>
}

function FeatureBullet({ item }: { item: FeatureItem }) {
	return (
		<li className={`flex items-start gap-2${item.isSubItem ? ' ml-7 sm:ml-5' : ''}`}>
			{item.isSubItem ? (
				<span className="inline-flex size-6 shrink-0 items-center justify-center body-lg text-sub-text-secondary sm:h-5 sm:w-5 sm:body-md">
					–
				</span>
			) : (
				<span className="shrink-0">
					{/* The icon is the only sign of whether the plan has the feature, so it carries a name. */}
					<span className="sr-only">{item.availability === 'check' ? 'Included: ' : 'Not included: '}</span>
					{item.availability === 'check' ? (
						<Icon name="check" height={24} width={24} className="text-sub-brand-secondary sm:h-5 sm:w-5" />
					) : item.availability === 'x' ? (
						<Icon name="x" height={24} width={24} className="text-error sm:h-5 sm:w-5" />
					) : (
						<Icon
							name="minus"
							height={24}
							width={24}
							className="text-sub-icon-muted sm:h-5 sm:w-5 dark:text-sub-icon-muted"
						/>
					)}
				</span>
			)}
			{item.highlightText ? (
				<span className="bg-linear-to-r from-sub-brand-primary to-sub-brand-soft bg-clip-text body-lg text-transparent sm:pt-0.5 sm:body-md dark:from-sub-brand-secondary dark:to-sub-brand-softest">
					<FeatureLabel item={item} />
				</span>
			) : (
				<span
					className={`body-lg sm:pt-0.5 sm:body-md ${item.availability === 'check' || item.availability === 'x' ? 'text-sub-text-primary' : 'text-sub-text-muted dark:text-sub-text-muted'}`}
				>
					<FeatureLabel item={item} />
				</span>
			)}
		</li>
	)
}

/* ── PricingCardCta ────────────────────────────────────────────────── */

// The pricing CTAs are standalone full-width conversion buttons, so they are Button size="lg".

// Where a non-Stripe plan is actually managed; Stripe checkout/portal actions
// don't apply to these providers.
function ProviderManageNotice({ provider }: { provider: string | null }) {
	if (provider === 'llamapay' || provider === 'legacy') {
		return (
			<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">
				Your plan is billed through{' '}
				<a
					href="https://subscriptions.llamapay.io/"
					target="_blank"
					rel="noopener noreferrer"
					className="underline hover:text-sub-brand-primary"
				>
					LlamaPay
				</a>
				. Manage or change it there.
			</p>
		)
	}
	if (provider === 'apple') {
		return (
			<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">
				Your plan is billed through the App Store. Manage it in your Apple subscription settings.
			</p>
		)
	}
	if (provider === 'google_play') {
		return (
			<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">
				Your plan is billed through Google Play. Manage it in your Google Play subscription settings.
			</p>
		)
	}
	return null
}

function PricingCardCta({
	card,
	isCurrentPlan,
	isTrial,
	isCancelPending,
	isAuthenticated,
	canUpgradeCycle,
	isUpgradeTier,
	isLowerTier,
	isManualSubscription,
	currentProvider,
	isTeamProvided,
	isPageStateLoading,
	onPrimaryCtaClick,
	onSecondaryCtaClick,
	onUpgradeToYearly,
	onUpgradeTier,
	onStartTrial,
	onEndTrial,
	onRevertCancellation,
	isTrialAvailable,
	loading,
	cryptoError
}: {
	card: PricingCardData
	isCurrentPlan: boolean
	isTrial: boolean
	isCancelPending: boolean
	isAuthenticated: boolean
	canUpgradeCycle: boolean
	isUpgradeTier: boolean
	isLowerTier: boolean | '' | null | 0
	isManualSubscription?: boolean
	currentProvider?: string | null
	isTeamProvided?: boolean
	billingCycle: BillingCycle
	isPageStateLoading?: boolean
} & PricingCardCallbacks) {
	const isEndTrialApplying = useEndTrialApplying()

	/* ── Still loading auth/subscription data: hide CTAs ── */
	if (isPageStateLoading) return null

	const checkoutEvent = (provider: 'stripe' | 'llamapay') =>
		card.key === 'pro' || card.key === 'api'
			? {
					'data-umami-event': 'subscribe-checkout',
					'data-umami-event-plan': card.key,
					'data-umami-event-provider': provider
				}
			: {}

	/* ── Team-granted and team-seat plans aren't self-serve; Contact Us stays valid ── */
	if (isManualSubscription || isTeamProvided) {
		if (card.key === 'enterprise') {
			return (
				<Button as="a" href="mailto:sales@defillama.com" variant="primary" size="lg" className="w-full">
					{card.primaryCta}
				</Button>
			)
		}
		if (!isCurrentPlan) return null
		return (
			<>
				<p className="mt-4 text-center label-lg text-sub-brand-primary sm:label-md dark:text-sub-brand-secondary">
					Current plan
				</p>
				<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">
					{isTeamProvided
						? `Your ${card.title} plan is provided through your team. Ask your team admin about plan changes.`
						: `Your ${card.title} plan was set up by the DefiLlama team. To change it, email support@defillama.com.`}
				</p>
			</>
		)
	}

	/* ── Lower tier than current subscription: no CTA ── */
	if (isLowerTier) return null

	const isSelfServeStripe = currentProvider === 'stripe'

	/* ── Current plan: show label + optional yearly upgrade ── */
	if (isCurrentPlan) {
		return (
			<>
				<p className="mt-4 text-center label-lg text-sub-brand-primary sm:label-md dark:text-sub-brand-secondary">
					{isTrial ? 'Current plan (trial)' : 'Current plan'}
				</p>
				{isCancelPending ? (
					<div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
						<p className="text-center label-sm text-warning">Cancellation scheduled</p>
						<p className="text-center body-sm text-sub-text-muted">
							Your plan stays active until the end of the billing period.
						</p>
						{/* Reverting opens the Stripe billing portal, so it only applies to Stripe plans */}
						{isSelfServeStripe ? (
							<p className="text-center label-sm">
								<Button variant="link" onClick={onRevertCancellation}>
									Revert cancellation
								</Button>
							</p>
						) : null}
					</div>
				) : null}
				{!isSelfServeStripe && !isTrial ? <ProviderManageNotice provider={currentProvider ?? null} /> : null}
				{isTrial ? (
					<>
						{/* The hold starts in the dialog this button opened, and that dialog returns focus here on close. */}
						<Button
							variant="primary"
							size="lg"
							className="w-full"
							onClick={onEndTrial}
							disabled={isEndTrialApplying}
							accessibleWhenDisabled
						>
							Upgrade to full access
						</Button>
						{isEndTrialApplying ? (
							<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">
								{END_TRIAL_APPLYING_REASON}
							</p>
						) : null}
					</>
				) : null}
				{canUpgradeCycle && !isCancelPending ? (
					<>
						<Button variant="primary" size="lg" className="w-full" onClick={() => onUpgradeToYearly?.(card.key)}>
							Upgrade to yearly
						</Button>
						<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">
							Switch to annual billing — save {card.key === 'api' ? '$600' : '$98'}/year
						</p>
					</>
				) : null}
			</>
		)
	}

	/* ── Higher-tier upgrade ── */
	if (isUpgradeTier) {
		if (card.key === 'enterprise') {
			return (
				<Button as="a" href="mailto:sales@defillama.com" variant="primary" size="lg" className="w-full">
					{card.primaryCta}
				</Button>
			)
		}
		// The upgrade flow charges through Stripe; a plan billed elsewhere must be
		// changed with its own provider first or the user gets billed twice.
		if (!isSelfServeStripe) {
			return <ProviderManageNotice provider={currentProvider ?? null} />
		}
		return (
			<Button
				variant="primary"
				size="lg"
				className="w-full"
				onClick={() => onUpgradeTier?.(card.key)}
				pendingLabel={loading === 'stripe' ? 'Processing…' : null}
			>
				Upgrade to {card.title} with Card
			</Button>
		)
	}

	/* ── Default: standard CTAs ── */
	return (
		<>
			{card.key === 'pro' && isTrialAvailable ? (
				<>
					{/* ── Split CTA: trial vs subscribe side-by-side ── */}
					<div className="flex flex-wrap gap-2">
						{/* The trial CTA takes the success green through the .sub-trial-accent token scope; `contents` keeps
						    the Button a flex item of this row. */}
						<span className="sub-trial-accent contents">
							<Button
								variant="primary"
								size="lg"
								className="flex-1"
								onClick={onStartTrial}
								data-umami-event="subscribe-trial-start"
							>
								Start free trial
							</Button>
						</span>
						<Button
							variant="primary"
							size="lg"
							className="flex-1"
							onClick={() => onPrimaryCtaClick?.(card.key)}
							pendingLabel={loading === 'stripe' ? 'Processing…' : null}
							{...checkoutEvent('stripe')}
						>
							{card.primaryCta}
						</Button>
					</div>
					<div className="rounded-lg border border-sub-border-slate-100 px-3 py-2.5 body-sm text-sub-text-cool sm:px-2.5 sm:py-2 dark:border-sub-border-strong dark:text-sub-text-muted">
						<p className="label-sm text-success">Free trial differences:</p>
						<ul className="mt-1 flex flex-col gap-0.5">
							<li>• 3 deep research reports in total (vs 5/day)</li>
							<li>• No CSV downloads — paid Pro only</li>
						</ul>
						<p className="mt-1.5 body-xs">No charge for 7 days — converts to {PRO_TRIAL_CONVERSION_PRICE} after</p>
					</div>
					{card.secondaryCta ? (
						<Button
							variant="secondary"
							size="lg"
							className="w-full"
							onClick={() => onSecondaryCtaClick?.(card.key)}
							pendingLabel={loading === 'llamapay' ? 'Processing…' : null}
							{...checkoutEvent('llamapay')}
						>
							{card.secondaryCta}
						</Button>
					) : null}
				</>
			) : (
				<>
					{card.secondaryCta ? (
						<Button
							variant="secondary"
							size="lg"
							className="w-full"
							onClick={() => onSecondaryCtaClick?.(card.key)}
							pendingLabel={loading === 'llamapay' ? 'Processing…' : null}
							{...checkoutEvent('llamapay')}
						>
							{card.secondaryCta}
						</Button>
					) : null}
					<Button
						variant="primary"
						size="lg"
						className="w-full"
						onClick={() => onPrimaryCtaClick?.(card.key)}
						pendingLabel={loading === 'stripe' ? 'Processing…' : null}
						{...checkoutEvent('stripe')}
					>
						{card.primaryCta}
					</Button>
				</>
			)}
			{cryptoError?.cardKey === card.key ? <InlineStatus variant="error">{cryptoError.message}</InlineStatus> : null}
			{card.ctaSubtext ? (
				<p className="text-center body-sm text-sub-text-cool-muted dark:text-sub-text-muted">{card.ctaSubtext}</p>
			) : null}
			{!isAuthenticated && card.key !== 'free' && card.key !== 'enterprise' ? (
				<p className="text-center body-sm">
					<Button variant="link" onClick={() => onPrimaryCtaClick?.('free')}>
						Already a subscriber? Sign in
					</Button>
				</p>
			) : null}
		</>
	)
}

export function PricingCardContent({
	card,
	isTrialAvailable = false
}: {
	card: PricingCardData
	isTrialAvailable?: boolean
}) {
	return (
		<div className="flex flex-col gap-7 sm:gap-5">
			<div className="flex flex-col gap-2 sm:min-h-[140px] sm:gap-3">
				<h3 className="heading-sm text-sub-heading sm:text-sub-text-primary dark:text-sub-text-primary">
					{card.title}
				</h3>
				{card.subtitle ? (
					<p className="label-md text-sub-text-cool sm:text-sub-text-secondary dark:text-sub-text-muted">
						{card.subtitle}
					</p>
				) : null}
				{card.priceMain ? (
					<div className="flex flex-col gap-1 sm:gap-0">
						<div className="flex items-end gap-0.5">
							<p className="bg-linear-to-r from-sub-brand-primary to-sub-heading bg-clip-text heading-lg text-transparent dark:from-sub-brand-secondary dark:to-sub-brand-softest">
								{card.priceMain}
							</p>
							<p className="body-lg text-sub-text-cool sm:text-sub-text-secondary dark:sm:text-sub-text-secondary">
								{card.priceUnit}
							</p>
						</div>
						{card.key === 'pro' && isTrialAvailable ? (
							<div className="mt-1 flex items-center gap-1.5">
								<span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 title-sm text-success ring-1 ring-emerald-200 dark:bg-success/10 dark:ring-emerald-500/30">
									7-day free trial available
								</span>
							</div>
						) : card.priceSecondary ? (
							<p className="body-xl text-sub-text-cool-muted sm:body-lg dark:text-sub-text-muted">
								{card.priceSecondary}
							</p>
						) : null}
					</div>
				) : card.description ? (
					<p className="heading-lg text-sub-heading sm:heading-sm dark:text-sub-text-primary">{card.description}</p>
				) : null}
			</div>

			{card.includedTierText ? (
				<p className="body-md text-sub-text-cool-muted dark:text-sub-text-muted">{card.includedTierText}</p>
			) : null}

			{card.sections.map((section) => (
				<div key={`${card.key}-${section.title}`} className="flex flex-col gap-3">
					<h4 className="heading-sm text-sub-heading sm:label-lg sm:text-sub-text-primary dark:text-sub-text-primary">
						{section.title}
					</h4>
					<ul className="flex flex-col gap-3 sm:gap-2">
						{section.items.map((item) => (
							<FeatureBullet key={`${card.key}-${section.title}-${item.label}`} item={item} />
						))}
					</ul>
				</div>
			))}
		</div>
	)
}

/* ── PricingCard (responsive) ───────────────────────────────────────── */

export function PricingCard({
	card,
	isCurrentPlan = false,
	isTrial = false,
	isCancelPending = false,
	isAuthenticated = false,
	currentPlan = null,
	billingCycle = 'monthly',
	userBillingCycle = null,
	isManualSubscription = false,
	currentProvider = null,
	isTeamProvided = false,
	isPageStateLoading = false,
	onPrimaryCtaClick,
	onSecondaryCtaClick,
	onUpgradeToYearly,
	onUpgradeTier,
	onStartTrial,
	onEndTrial,
	onRevertCancellation,
	isTrialAvailable,
	loading,
	cryptoError
}: {
	card: PricingCardData
	isCurrentPlan?: boolean
	isTrial?: boolean
	isCancelPending?: boolean
	isAuthenticated?: boolean
	currentPlan?: PlanKey | null
	billingCycle?: BillingCycle
	userBillingCycle?: BillingCycle | null
	isManualSubscription?: boolean
	currentProvider?: string | null
	isTeamProvided?: boolean
	isPageStateLoading?: boolean
} & PricingCardCallbacks) {
	// The yearly upgrade runs through Stripe checkout, so it's only offered for
	// Stripe-billed personal plans.
	const canUpgradeCycle = isCurrentPlan && userBillingCycle === 'monthly' && currentProvider === 'stripe'
	const isUpgradeTier =
		isAuthenticated &&
		currentPlan &&
		currentPlan !== 'free' &&
		!isCurrentPlan &&
		card.key !== 'free' &&
		PLAN_TIER[card.key] > PLAN_TIER[currentPlan]
	const isLowerTier =
		isAuthenticated &&
		currentPlan &&
		currentPlan !== 'free' &&
		!isCurrentPlan &&
		PLAN_TIER[card.key] < PLAN_TIER[currentPlan]
	const isHighlighted = card.highlighted === true
	const wrapperClass = isHighlighted ? cardWrapperStyles.highlighted : cardWrapperStyles.default
	const shellClass = isHighlighted ? cardShellStyles.highlighted : cardShellStyles.default
	const innerClass = isHighlighted ? cardInnerStyles.highlighted : cardInnerStyles.default
	const badgeSlotClass = card.recommendedLabel
		? 'flex items-center justify-center text-center'
		: 'hidden sm:flex sm:h-[17px] sm:items-center sm:justify-center sm:opacity-0'

	return (
		<div className={`subscription-pricing-card ${wrapperClass}`} data-recommended={isHighlighted || undefined}>
			<div className={`subscription-pricing-shell ${shellClass}`}>
				<div className={`subscription-pricing-inner ${innerClass}`}>
					<div className="pricing-original mx-auto">
						<PricingCardContent card={card} isTrialAvailable={isTrialAvailable} />
					</div>
					<CoveragePricingContent card={card} isTrialAvailable={isTrialAvailable} />

					<div className="subscription-pricing-actions mx-auto mt-7 flex w-full flex-col gap-4 sm:mt-5 sm:gap-3">
						<PricingCardCta
							card={card}
							isCurrentPlan={isCurrentPlan}
							isTrial={isTrial}
							isCancelPending={isCancelPending}
							isAuthenticated={isAuthenticated}
							canUpgradeCycle={canUpgradeCycle}
							isUpgradeTier={isUpgradeTier}
							isLowerTier={isLowerTier}
							isManualSubscription={isManualSubscription}
							currentProvider={currentProvider}
							isTeamProvided={isTeamProvided}
							billingCycle={billingCycle}
							isPageStateLoading={isPageStateLoading}
							onPrimaryCtaClick={onPrimaryCtaClick}
							onSecondaryCtaClick={onSecondaryCtaClick}
							onUpgradeToYearly={onUpgradeToYearly}
							onUpgradeTier={onUpgradeTier}
							onStartTrial={onStartTrial}
							onEndTrial={onEndTrial}
							onRevertCancellation={onRevertCancellation}
							isTrialAvailable={isTrialAvailable}
							loading={loading}
							cryptoError={cryptoError}
						/>
						{isLowerTier ? (
							<p className="text-center label-sm text-sub-brand-primary dark:text-sub-brand-secondary">
								Included in your plan
							</p>
						) : null}
					</div>
				</div>
			</div>

			{card.recommendedLabel ? (
				<div className={`pricing-original ${badgeSlotClass}`}>
					<div className="text-center label-md text-sub-brand-softest">{card.recommendedLabel}</div>
				</div>
			) : (
				<div className={`pricing-original ${badgeSlotClass}`} aria-hidden="true" />
			)}
		</div>
	)
}

/* ── ComparisonCell (responsive) ────────────────────────────────────── */

export function ComparisonCell({
	value,
	plan,
	isSelected = false,
	className = '',
	hideBorderLeft = false,
	tooltip
}: {
	value: Availability
	plan: PlanKey
	isSelected?: boolean
	className?: string
	hideBorderLeft?: boolean
	tooltip?: string
}) {
	const selectedStyle = isSelected ? `relative z-10 ${selectedColumnStyles.active}` : selectedColumnStyles.inactive
	const borderEnd = plan === 'enterprise' ? 'border-r' : ''
	const isIncluded = value === 'check'
	const isLimited = value === 'limited'

	return (
		<div
			role="cell"
			aria-label={isIncluded ? 'Included' : isLimited ? 'Limited' : 'Not included'}
			className={`box-border flex w-[132px] shrink-0 items-center justify-center self-stretch ${isSelected || hideBorderLeft ? '' : 'border-l'} border-sub-border-slate-100 text-center md:w-[146px] md:border-sub-border-light dark:border-sub-dark-card dark:md:border-sub-dark-card ${selectedStyle} ${borderEnd} ${className}`}
		>
			{isIncluded ? (
				<Icon name="check" height={24} width={24} className="text-sub-brand-secondary" aria-hidden="true" />
			) : isLimited ? (
				// Focusable so keyboards reach the limit's explanation, and tappable on touch, not hover-only.
				<Tooltip
					content={tooltip}
					tabIndex={tooltip ? 0 : undefined}
					placement="top"
					className="cursor-help rounded-sm px-1"
				>
					<span className="label-md text-warning">Limited</span>
				</Tooltip>
			) : (
				<Icon
					name="minus"
					height={24}
					width={24}
					className="text-sub-text-cool-muted md:text-sub-border-muted dark:text-sub-border-strong-muted dark:md:text-sub-border-strong-muted"
					aria-hidden="true"
				/>
			)}
		</div>
	)
}
