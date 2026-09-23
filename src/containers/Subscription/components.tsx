import type {
	Availability,
	BillingCycle,
	FeatureItem,
	PlanKey,
	PricingCardCallbacks,
	PricingCardData
} from '~/containers/Subscription/types'
import { Icon } from '~/ui/Icon'

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
				<span className="inline-flex size-6 shrink-0 items-center justify-center text-base leading-6 text-sub-text-secondary sm:h-5 sm:w-5 sm:text-[13px] sm:leading-5">
					–
				</span>
			) : (
				<span className="shrink-0">
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
				<span className="bg-linear-to-r from-sub-brand-primary to-sub-brand-soft bg-clip-text text-base leading-6 text-transparent sm:pt-0.5 sm:text-[13px] sm:leading-[18px] dark:from-sub-brand-secondary dark:to-sub-brand-softest">
					<FeatureLabel item={item} />
				</span>
			) : (
				<span
					className={`text-base leading-6 sm:pt-0.5 sm:text-[13px] sm:leading-[18px] ${item.availability === 'check' || item.availability === 'x' ? 'text-sub-text-primary' : 'text-sub-text-muted dark:text-sub-text-muted'}`}
				>
					<FeatureLabel item={item} />
				</span>
			)}
		</li>
	)
}

/* ── PricingCardCta ────────────────────────────────────────────────── */

const outlineBtnCls =
	'h-14 w-full rounded-xl border border-sub-border-slate-100 bg-sub-surface-slate-10 text-base leading-5 font-medium text-sub-heading dark:border-sub-border-strong dark:bg-transparent dark:text-sub-text-primary sm:h-10 sm:rounded-lg sm:border-sub-border-muted sm:bg-white sm:text-sm sm:text-sub-text-primary dark:sm:border-sub-border-strong dark:sm:bg-transparent'
const filledBtnCls =
	'h-14 w-full rounded-xl bg-sub-brand-primary text-base leading-5 font-medium text-on-brand sm:h-10 sm:rounded-lg sm:text-sm'

// Where a non-Stripe plan is actually managed; Stripe checkout/portal actions
// don't apply to these providers.
function ProviderManageNotice({ provider }: { provider: string | null }) {
	if (provider === 'llamapay' || provider === 'legacy') {
		return (
			<p className="text-center text-[13px] leading-5 text-sub-text-cool-muted dark:text-sub-text-muted">
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
			<p className="text-center text-[13px] leading-5 text-sub-text-cool-muted dark:text-sub-text-muted">
				Your plan is billed through the App Store. Manage it in your Apple subscription settings.
			</p>
		)
	}
	if (provider === 'google_play') {
		return (
			<p className="text-center text-[13px] leading-5 text-sub-text-cool-muted dark:text-sub-text-muted">
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
	loading
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
				<a href="mailto:sales@defillama.com" className={`${filledBtnCls} flex items-center justify-center`}>
					{card.primaryCta}
				</a>
			)
		}
		if (!isCurrentPlan) return null
		return (
			<>
				<p className="mt-4 text-center text-base leading-5 font-medium text-sub-brand-primary sm:text-sm dark:text-sub-brand-secondary">
					Current Plan
				</p>
				<p className="text-center text-[13px] leading-5 text-sub-text-cool-muted dark:text-sub-text-muted">
					{isTeamProvided
						? `Your ${card.title} plan is provided through your team. Ask your team admin about plan changes.`
						: `Your ${card.title} plan was provided by the DefiLlama team. To make any changes, please contact the team.`}
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
				<p className="mt-4 text-center text-base leading-5 font-medium text-sub-brand-primary sm:text-sm dark:text-sub-brand-secondary">
					{isTrial ? 'Current Plan (trial)' : 'Current Plan'}
				</p>
				{isCancelPending ? (
					<div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
						<p className="text-center text-[13px] leading-5 font-medium text-warning">Cancellation scheduled</p>
						<p className="text-center text-xs leading-4 text-sub-text-muted">
							Your plan stays active until the end of the billing period.
						</p>
						{/* Reverting opens the Stripe billing portal, so it only applies to Stripe plans */}
						{isSelfServeStripe ? (
							<button
								type="button"
								className="mt-1 text-[13px] leading-5 font-medium text-sub-brand-primary underline hover:text-sub-brand-secondary"
								onClick={onRevertCancellation}
							>
								Revert Cancellation
							</button>
						) : null}
					</div>
				) : null}
				{!isSelfServeStripe && !isTrial ? <ProviderManageNotice provider={currentProvider ?? null} /> : null}
				{isTrial ? (
					<button type="button" className={filledBtnCls} onClick={onEndTrial}>
						Upgrade to Full Access
					</button>
				) : null}
				{canUpgradeCycle && !isCancelPending ? (
					<>
						<button type="button" className={filledBtnCls} onClick={() => onUpgradeToYearly?.(card.key)}>
							Upgrade to Yearly
						</button>
						<p className="text-center text-xs leading-4 text-sub-text-cool-muted dark:text-sub-text-muted">
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
				<a href="mailto:sales@defillama.com" className={`${filledBtnCls} flex items-center justify-center`}>
					{card.primaryCta}
				</a>
			)
		}
		// The upgrade flow charges through Stripe; a plan billed elsewhere must be
		// changed with its own provider first or the user gets billed twice.
		if (!isSelfServeStripe) {
			return <ProviderManageNotice provider={currentProvider ?? null} />
		}
		return (
			<button
				type="button"
				className={filledBtnCls}
				onClick={() => onUpgradeTier?.(card.key)}
				disabled={loading === 'stripe'}
			>
				{loading === 'stripe' ? 'Processing...' : `Upgrade to ${card.title} with Card`}
			</button>
		)
	}

	/* ── Default: standard CTAs ── */
	return (
		<>
			{card.key === 'pro' && isTrialAvailable ? (
				<>
					{/* ── Split CTA: trial vs subscribe side-by-side ── */}
					<div className="flex gap-2">
						<button
							type="button"
							className="h-14 flex-1 rounded-xl bg-emerald-600 text-base leading-5 font-medium text-on-brand sm:h-10 sm:rounded-lg sm:text-sm"
							onClick={onStartTrial}
							data-umami-event="subscribe-trial-start"
						>
							Start Free Trial
						</button>
						<button
							type="button"
							className="h-14 flex-1 rounded-xl bg-sub-brand-primary text-base leading-5 font-medium text-on-brand sm:h-10 sm:rounded-lg sm:text-sm"
							onClick={() => onPrimaryCtaClick?.(card.key)}
							disabled={loading === 'stripe'}
							{...checkoutEvent('stripe')}
						>
							{loading === 'stripe' ? 'Processing...' : card.primaryCta}
						</button>
					</div>
					<div className="rounded-[10px] border border-sub-border-slate-100 px-3 py-2.5 text-xs leading-4 text-sub-text-cool sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-[11px] dark:border-sub-border-strong dark:text-sub-text-muted">
						<p className="font-medium text-success dark:text-success">Free trial differences:</p>
						<ul className="mt-1 flex flex-col gap-0.5">
							<li>• 3 deep research questions/day (vs 5)</li>
							<li>• No CSV downloads — paid Pro only</li>
						</ul>
						<p className="mt-1.5 text-[11px] sm:text-[10px]">
							No charge for 7 days — converts to {card.priceMain}
							{card.priceUnit} after
						</p>
					</div>
					{card.secondaryCta ? (
						<button
							type="button"
							className={outlineBtnCls}
							onClick={() => onSecondaryCtaClick?.(card.key)}
							disabled={loading === 'llamapay'}
							{...checkoutEvent('llamapay')}
						>
							{loading === 'llamapay' ? 'Processing...' : card.secondaryCta}
						</button>
					) : null}
				</>
			) : (
				<>
					{card.secondaryCta ? (
						<button
							type="button"
							className={outlineBtnCls}
							onClick={() => onSecondaryCtaClick?.(card.key)}
							disabled={loading === 'llamapay'}
							{...checkoutEvent('llamapay')}
						>
							{loading === 'llamapay' ? 'Processing...' : card.secondaryCta}
						</button>
					) : null}
					<button
						type="button"
						className={filledBtnCls}
						onClick={() => onPrimaryCtaClick?.(card.key)}
						disabled={loading === 'stripe'}
						{...checkoutEvent('stripe')}
					>
						{loading === 'stripe' ? 'Processing...' : card.primaryCta}
					</button>
				</>
			)}
			{card.ctaSubtext ? (
				<p className="text-center text-xs leading-4 text-sub-text-cool-muted dark:text-sub-text-muted">
					{card.ctaSubtext}
				</p>
			) : null}
			{!isAuthenticated && card.key !== 'free' && card.key !== 'enterprise' ? (
				<button
					type="button"
					className="text-[13px] leading-5 text-sub-text-cool-muted underline hover:text-sub-brand-primary dark:text-sub-text-muted dark:hover:text-sub-brand-secondary"
					onClick={() => onPrimaryCtaClick?.('free')}
				>
					Already a subscriber? Sign In
				</button>
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
				<h3 className="text-[22px] leading-[28px] font-semibold text-sub-heading sm:text-xl sm:leading-[26px] sm:text-sub-text-primary dark:text-sub-text-primary">
					{card.title}
				</h3>
				{card.subtitle ? (
					<p className="text-[15px] leading-5 font-medium text-sub-text-cool sm:text-sm sm:leading-4 sm:text-sub-text-secondary dark:text-sub-text-muted">
						{card.subtitle}
					</p>
				) : null}
				{card.priceMain ? (
					<div className="flex flex-col gap-1 sm:gap-0">
						<div className="flex items-end gap-0.5">
							<p className="bg-linear-to-r from-sub-brand-primary to-sub-heading bg-clip-text text-[40px] leading-[40px] font-semibold text-transparent sm:text-[32px] sm:leading-[42px] dark:from-sub-brand-secondary dark:to-sub-brand-softest">
								{card.priceMain}
							</p>
							<p className="text-base leading-6 text-sub-text-cool sm:text-base sm:text-sub-text-secondary dark:sm:text-sub-text-secondary">
								{card.priceUnit}
							</p>
						</div>
						{card.key === 'pro' && isTrialAvailable ? (
							<div className="mt-1 flex items-center gap-1.5">
								<span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs leading-4 font-semibold text-success ring-1 ring-emerald-200 dark:bg-success/10 dark:ring-emerald-500/30">
									7-day free trial available
								</span>
							</div>
						) : card.priceSecondary ? (
							<p className="text-[22px] leading-6 text-sub-text-cool-muted sm:text-base dark:text-sub-text-muted">
								{card.priceSecondary}
							</p>
						) : null}
					</div>
				) : card.description ? (
					<p className="text-[28px] leading-[36px] font-semibold text-sub-heading sm:text-2xl sm:leading-[32px] dark:text-sub-text-primary">
						{card.description}
					</p>
				) : null}
			</div>

			{card.includedTierText ? (
				<p className="text-[13px] leading-5 text-sub-text-cool-muted dark:text-sub-text-muted">
					{card.includedTierText}
				</p>
			) : null}

			{card.sections.map((section) => (
				<div key={`${card.key}-${section.title}`} className="flex flex-col gap-3">
					<h4 className="text-xl leading-7 font-semibold text-sub-heading sm:text-base sm:leading-5 sm:font-medium sm:text-sub-text-primary dark:text-sub-text-primary">
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
	loading
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
		<div className={wrapperClass}>
			<div className={shellClass}>
				<div className={innerClass}>
					<div className="mx-auto">
						<PricingCardContent card={card} isTrialAvailable={isTrialAvailable} />
					</div>

					<div className="mx-auto mt-7 flex w-full flex-col gap-4 sm:mt-5 sm:gap-3">
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
						/>
						{isLowerTier ? (
							<p className="text-center text-[13px] leading-5 font-medium text-sub-brand-primary dark:text-sub-brand-secondary">
								Included in your plan
							</p>
						) : null}
					</div>
				</div>
			</div>

			{card.recommendedLabel ? (
				<div className={badgeSlotClass}>
					<div className="text-center text-sm leading-[17px] font-medium text-sub-brand-softest">
						{card.recommendedLabel}
					</div>
				</div>
			) : (
				<div className={badgeSlotClass} aria-hidden="true" />
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
				<span className="group relative cursor-help">
					<span className="text-[13px] font-medium text-warning">Limited</span>
					{tooltip ? (
						<span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg bg-sub-dark-page px-3 py-2 text-xs leading-4 font-normal text-on-brand opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-sub-dark-card">
							{tooltip}
						</span>
					) : null}
				</span>
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
