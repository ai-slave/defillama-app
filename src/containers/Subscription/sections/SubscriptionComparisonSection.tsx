import { type CSSProperties, type UIEvent, useRef } from 'react'
import { ComparisonCell, SELECTED_COLUMN_HIGHLIGHT } from '~/containers/Subscription/components'
import { PLAN_META_BY_CYCLE } from '~/containers/Subscription/data'
import type { BillingCycle, ComparisonSection, PlanKey } from '~/containers/Subscription/types'

/* ── Style maps ────────────────────────────────────────────────────── */

const planHeadStyles = {
	selected: 'border-x border-sub-brand-primary bg-brand/6 dark:bg-sub-brand-primary/5 md:rounded-t-[16px]',
	default: 'border-sub-mobile-table-border md:border-sub-desktop-table-border md:bg-white dark:md:bg-transparent'
}

const planHeadButtonStyles = {
	selected: 'border-sub-brand-primary bg-sub-brand-primary text-on-brand',
	default:
		'border-sub-border-slate-100 bg-white text-sub-heading dark:border-sub-border-strong dark:bg-transparent dark:text-sub-text-primary md:border-sub-border-muted md:text-sub-text-primary dark:md:border-sub-border-strong dark:md:bg-transparent'
}

// Placed from the table's fixed column widths (label 233px, plan 132px; 400px and 146px from md), so CSS
// resolves the breakpoint and the overlays are in the server HTML.
function SelectedColumnRails({ index, roundBottom = false }: { index: number; roundBottom?: boolean }) {
	return (
		<div
			aria-hidden="true"
			className={`pointer-events-none absolute -top-px bottom-0 left-[calc(233px+var(--plan-index)*132px)] z-20 w-[132px] border-x border-sub-brand-primary md:left-[calc(400px+var(--plan-index)*146px)] md:w-[146px] ${roundBottom ? 'rounded-b-[16px] border-b' : ''}`}
			style={{ '--plan-index': index } as CSSProperties}
		/>
	)
}

function PlanGridBottomOutline({ count }: { count: number }) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute bottom-0 left-[233px] z-0 h-[41px] w-[calc(var(--plan-count)*132px)] rounded-br-[16px] rounded-bl-[16px] border-b border-sub-mobile-table-border md:left-[400px] md:h-[36px] md:w-[calc(var(--plan-count)*146px)] md:rounded-br-[24px] md:rounded-bl-[24px] md:border-sub-desktop-table-border"
			style={{ '--plan-count': count } as CSSProperties}
		/>
	)
}

/* ── ComparisonPlanHead ────────────────────────────────────────────── */

const PLAN_TIER: Record<PlanKey, number> = { free: 0, pro: 1, api: 2, enterprise: 3 }

function ComparisonPlanHead({
	plan,
	billingCycle,
	isFirst,
	isLast,
	isSelected,
	isCurrentPlan,
	isLowerTier,
	hideAction,
	onAction
}: {
	plan: PlanKey
	billingCycle: BillingCycle
	isFirst: boolean
	isLast: boolean
	isSelected: boolean
	isCurrentPlan: boolean
	isLowerTier: boolean
	hideAction?: boolean
	onAction?: (plan: PlanKey) => void
}) {
	const meta = PLAN_META_BY_CYCLE[billingCycle][plan]
	const colStyle = isSelected ? planHeadStyles.selected : planHeadStyles.default
	const btnStyle = isSelected ? planHeadButtonStyles.selected : planHeadButtonStyles.default
	const edgeBorderClass = isSelected ? '' : `${isFirst ? 'border-l' : ''} ${isLast ? 'border-r' : ''}`
	const slashIdx = meta.price.indexOf('/')
	const priceValue = slashIdx >= 0 ? meta.price.slice(0, slashIdx) : meta.price
	const priceUnit = slashIdx >= 0 ? meta.price.slice(slashIdx) : null

	return (
		<div
			role="columnheader"
			className={`box-border w-[132px] shrink-0 border-t md:w-[146px] ${colStyle} ${edgeBorderClass} ${isFirst ? 'rounded-tl-[16px] md:rounded-tl-[24px]' : ''} ${isLast ? 'rounded-tr-[16px] md:rounded-tr-[24px]' : ''}`}
		>
			<div className="flex h-full flex-col justify-between p-3 md:p-5">
				<div>
					<p className="text-sm leading-4 font-medium text-sub-heading md:text-lg md:leading-5 md:text-sub-text-primary dark:text-sub-text-primary">
						{meta.title}
					</p>
					<div className="mt-1 flex items-end gap-px">
						<p className="bg-linear-to-r from-sub-brand-secondary to-sub-brand-softest bg-clip-text text-xs leading-[17px] font-medium text-transparent md:text-sm">
							{priceValue}
						</p>
						{priceUnit ? (
							<p className="text-xs leading-4 text-sub-mobile-text-muted md:text-xs md:text-sub-desktop-text-muted">
								{priceUnit}
							</p>
						) : null}
					</div>
					{meta.priceSecondary ? (
						<p className="text-[10px] leading-3 text-sub-mobile-text-muted md:text-[11px] md:text-sub-desktop-text-muted">
							{meta.priceSecondary}
						</p>
					) : null}
				</div>
				{isCurrentPlan || isLowerTier ? (
					<p className="text-center text-[10px] leading-7 font-medium text-sub-brand-primary md:text-xs dark:text-sub-brand-secondary">
						{isCurrentPlan ? 'Current plan' : 'Unlocked'}
					</p>
				) : hideAction ? null : (
					<button
						type="button"
						className={`h-7 rounded-[6px] border px-2 text-[10px] leading-3 md:h-8 md:rounded-lg md:text-xs ${btnStyle}`}
						onClick={() => onAction?.(plan)}
					>
						{meta.action}
					</button>
				)}
			</div>
		</div>
	)
}

/* ── SubscriptionComparisonSection ─────────────────────────────────── */

export function SubscriptionComparisonSection({
	planOrder,
	comparisonSections,
	billingCycle,
	selectedPlan,
	currentPlan = null,
	hidePlanActions = false,
	onPlanAction
}: {
	planOrder: Array<PlanKey>
	comparisonSections: Array<ComparisonSection>
	billingCycle: BillingCycle
	selectedPlan: PlanKey
	currentPlan?: PlanKey | null
	// Withhold plan-change buttons while the current plan is unknown
	hidePlanActions?: boolean
	onPlanAction?: (plan: PlanKey) => void
}) {
	const headerPlanTrackRef = useRef<HTMLDivElement>(null)
	const selectedIndex = planOrder.indexOf(selectedPlan)

	/* ── Sync horizontal scroll: body → header track ── */
	// The browser fires scroll when a narrower table clamps scrollLeft, so this also covers plan and billing switches.
	const onBodyScroll = (event: UIEvent<HTMLDivElement>) => {
		headerPlanTrackRef.current!.style.transform = `translate3d(${-event.currentTarget.scrollLeft}px, 0, 0)`
	}

	return (
		<section className="mt-12 bg-white py-12 md:mt-0 md:py-20 dark:bg-sub-mobile-table-section-bg md:dark:bg-sub-desktop-table-section-bg">
			<div className="mx-auto w-full px-2 md:max-w-[984px] md:px-0">
				{/* ── Sticky plan header (mobile: sticky top-0, desktop: static) ── */}
				<div className="sticky top-0 z-40 overflow-hidden bg-white md:static dark:bg-sub-mobile-table-section-bg dark:md:bg-sub-desktop-table-section-bg">
					<div className="flex" role="row">
						<div
							role="columnheader"
							className="sticky left-0 z-30 box-border flex h-[132px] w-[233px] shrink-0 items-center bg-white px-2 md:h-[129px] md:w-[400px] md:rounded-tl-[24px] md:px-4 dark:bg-sub-mobile-table-section-bg dark:md:bg-sub-desktop-table-section-bg"
						>
							<h2 className="text-xl leading-7 font-semibold text-sub-heading md:w-[220px] md:text-2xl md:leading-[34px] md:text-sub-text-primary dark:text-sub-text-primary">
								Compare Plans and Features
							</h2>
						</div>

						<div className="min-w-0 flex-1 overflow-hidden">
							<div ref={headerPlanTrackRef} className="w-max [will-change:transform]">
								<div className="flex h-[132px] rounded-t-[16px] border-t border-sub-mobile-table-border md:h-[129px] md:rounded-t-[24px] md:border-sub-desktop-table-border">
									{planOrder.map((plan, index) => (
										<ComparisonPlanHead
											key={`plan-head-${plan}`}
											plan={plan}
											billingCycle={billingCycle}
											isFirst={index === 0}
											isLast={index === planOrder.length - 1}
											isSelected={plan === selectedPlan}
											isCurrentPlan={plan === currentPlan}
											isLowerTier={
												currentPlan != null && currentPlan !== 'free' && PLAN_TIER[plan] < PLAN_TIER[currentPlan]
											}
											hideAction={hidePlanActions && plan !== 'enterprise'}
											onAction={onPlanAction}
										/>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* ── Scrollable body ── */}
				<div
					className="relative isolate scrollbar-none overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch]"
					onScroll={onBodyScroll}
				>
					<div className="w-max" role="table" aria-label="Plan comparison">
						<div className="relative">
							{comparisonSections.map((section, sectionIndex) => {
								const isLastSection = sectionIndex === comparisonSections.length - 1
								const hasWrappedLastRow = section.rows[section.rows.length - 1]?.wrapLabel
								return (
									<div key={section.title} role="rowgroup" className="relative isolate">
										<div
											className="relative z-[25] flex h-10 bg-sub-mobile-table-header-bg md:h-9 md:bg-sub-desktop-table-header-bg"
											role="row"
										>
											<div
												role="rowheader"
												className="sticky left-0 z-30 box-border flex w-[233px] shrink-0 items-center bg-sub-mobile-table-header-bg px-2 text-sm leading-[21px] font-medium text-sub-heading md:w-[400px] md:bg-sub-desktop-table-header-bg md:px-4 md:text-base md:leading-5 md:text-sub-text-primary dark:text-sub-text-primary"
											>
												{section.title}
											</div>
											{planOrder.map((plan, planIndex) => {
												const prevPlan = planIndex > 0 ? planOrder[planIndex - 1] : null
												return (
													<div
														key={`${section.title}-header-${plan}`}
														role="cell"
														className={`box-border w-[132px] shrink-0 md:w-[146px] ${prevPlan === selectedPlan || plan === selectedPlan ? '' : 'border-l'} ${plan === selectedPlan ? 'relative z-10 border-x border-sub-brand-primary' : 'border-sub-mobile-table-border md:border-sub-desktop-table-border'} ${plan === selectedPlan ? SELECTED_COLUMN_HIGHLIGHT : ''} ${plan !== selectedPlan && plan === 'enterprise' ? 'border-r' : ''}`}
													/>
												)
											})}
										</div>

										{section.rows.map((row, rowIndex) => {
											const isLastRow = isLastSection && rowIndex === section.rows.length - 1
											const rowClassName = row.wrapLabel
												? 'relative flex min-h-[41px] md:h-[36px]'
												: 'relative flex h-[41px] md:h-[36px]'
											const rowHeaderDividerClassName = isLastRow
												? ''
												: 'border-b border-sub-mobile-table-border md:border-sub-desktop-table-border'
											const rowCellDividerClassName = isLastRow
												? ''
												: 'border-b border-b-sub-mobile-table-border md:border-b-sub-desktop-table-border'
											const rowHeaderClassName = row.wrapLabel
												? `sticky left-0 z-30 box-border flex w-[233px] shrink-0 items-start bg-white px-2 py-2 text-sm leading-[21px] text-sub-mobile-text-muted md:w-[400px] md:items-center md:px-4 md:py-0 md:text-xs md:text-sub-desktop-text-muted dark:bg-sub-mobile-table-section-bg dark:md:bg-sub-desktop-table-section-bg ${rowHeaderDividerClassName}`
												: `sticky left-0 z-30 box-border flex w-[233px] shrink-0 items-center bg-white px-2 text-sm leading-[21px] text-sub-mobile-text-muted md:w-[400px] md:px-4 md:text-xs md:text-sub-desktop-text-muted dark:bg-sub-mobile-table-section-bg dark:md:bg-sub-desktop-table-section-bg ${rowHeaderDividerClassName}`
											const rowLabelClassName = row.wrapLabel
												? 'block w-full whitespace-normal break-words md:overflow-hidden md:text-ellipsis md:whitespace-nowrap'
												: 'block w-full truncate'
											return (
												<div key={`${section.title}-${row.label}`} role="row" className={rowClassName}>
													<div role="rowheader" className={rowHeaderClassName}>
														{row.link ? (
															<a
																href={row.link}
																className={`${rowLabelClassName} text-current no-underline underline-offset-2 hover:text-sub-heading hover:underline md:hover:text-sub-dark-page dark:hover:text-sub-text-primary`}
															>
																{row.label}
															</a>
														) : (
															<span className={rowLabelClassName}>{row.label}</span>
														)}
													</div>
													{planOrder.map((plan, planIndex) => {
														const prevPlan = planIndex > 0 ? planOrder[planIndex - 1] : null
														let lastRowCls = ''
														if (isLastRow) {
															lastRowCls = 'border-b'
															if (planIndex === 0) lastRowCls += ' rounded-bl-[16px] md:rounded-bl-[24px]'
															if (planIndex === planOrder.length - 1)
																lastRowCls += ' rounded-br-[16px] md:rounded-br-[24px]'
															if (plan === selectedPlan) lastRowCls += ' border-b-sub-brand-primary rounded-b-[16px]'
														}
														return (
															<ComparisonCell
																key={`${section.title}-${row.label}-${plan}`}
																value={row.values[plan]}
																plan={plan}
																isSelected={plan === selectedPlan}
																hideBorderLeft={prevPlan === selectedPlan}
																className={`${rowCellDividerClassName} ${lastRowCls}`.trim() || undefined}
																tooltip={row.tooltips?.[plan]}
															/>
														)
													})}
												</div>
											)
										})}

										{isLastSection && !hasWrappedLastRow ? <PlanGridBottomOutline count={planOrder.length} /> : null}
										<SelectedColumnRails index={selectedIndex} roundBottom={isLastSection} />
									</div>
								)
							})}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
