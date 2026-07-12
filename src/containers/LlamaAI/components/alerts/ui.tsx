import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Icon, type IIcon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { formatPriceDisplay, normalizePriceInput } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'

const settingsIntegrationsLinkClass =
	'cursor-pointer underline decoration-dotted underline-offset-2 transition-colors hover:text-(--link-text)'

export function SettingsIntegrationsLink() {
	const { openSettingsModal } = useTipActions()
	if (openSettingsModal) {
		return (
			<button type="button" onClick={() => openSettingsModal('integrations')} className={settingsIntegrationsLinkClass}>
				Settings → Integrations
			</button>
		)
	}
	return (
		<BasicLink
			href="/ai/chat?modal=settings&tab=integrations"
			target="_blank"
			rel="noopener noreferrer"
			className={settingsIntegrationsLinkClass}
		>
			Settings → Integrations
		</BasicLink>
	)
}

export const alertDialogClass =
	'dialog max-h-[85vh] w-full max-w-lg gap-0 overflow-hidden rounded-2xl border border-black/5 bg-white p-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] max-sm:max-h-[calc(100dvh-80px)] max-sm:rounded-b-none dark:border-white/[0.06] dark:bg-[#17181C] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]'

export const alertBackdropClass = 'backdrop fixed inset-0 bg-black/60 backdrop-blur-md'

export const alertInputClass =
	'w-full rounded-lg border border-black/[0.08] bg-black/[0.015] px-3 py-2 text-sm text-[#1a1a1a] placeholder-[#aaa] transition-all outline-none focus:border-(--link-text)/40 focus:bg-white focus:ring-4 focus:ring-(--link-text)/[0.08] dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white dark:placeholder-[#555] dark:focus:bg-white/[0.04]'

export const alertSelectClass =
	'rounded-lg border border-black/[0.08] bg-black/[0.015] px-2.5 py-2 text-sm text-[#1a1a1a] transition-all outline-none focus:border-(--link-text)/40 focus:bg-white focus:ring-4 focus:ring-(--link-text)/[0.08] dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white dark:focus:bg-[#17181C]'

export const alertFieldLabelClass = 'text-xs font-medium text-[#777] dark:text-[#919296]'

export const alertPrimaryButtonClass =
	'flex items-center justify-center gap-1.5 rounded-lg bg-(--old-blue) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a58b4] disabled:cursor-not-allowed disabled:opacity-50'

export const alertGhostButtonClass =
	'rounded-lg px-3 py-2 text-sm text-[#666] transition-colors hover:bg-black/[0.04] hover:text-black dark:text-[#919296] dark:hover:bg-white/[0.05] dark:hover:text-white'

export const alertIconButtonClass =
	'flex size-7 items-center justify-center rounded-lg text-[#999] transition-colors hover:bg-black/[0.05] hover:text-(--text-primary) dark:text-[#777] dark:hover:bg-white/[0.06] dark:hover:text-white'

export function AlertsDialogHeader({
	title,
	subtitle,
	icon = 'calendar-plus',
	right
}: {
	title: string
	subtitle?: string
	icon?: IIcon['name']
	right?: ReactNode
}) {
	return (
		<header className="relative shrink-0 overflow-hidden border-b border-black/[0.06] dark:border-white/[0.05]">
			<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-transparent dark:from-amber-400/[0.06]" />
			<div className="relative flex items-center justify-between gap-3 px-5 py-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-1 ring-amber-500/20 ring-inset">
						<Icon name={icon} className="size-4 text-amber-500" />
					</div>
					<div className="flex min-w-0 flex-col leading-tight">
						<h2 className="m-0 text-base font-semibold tracking-tight text-black dark:text-white">{title}</h2>
						{subtitle ? (
							<p className="m-0 mt-0.5 truncate text-xs text-[#777] dark:text-[#919296]">{subtitle}</p>
						) : null}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{right}
					<Ariakit.DialogDismiss className="rounded-lg p-2 text-[#666] transition-colors hover:bg-black/[0.05] hover:text-black dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white">
						<Icon name="x" className="size-4" />
					</Ariakit.DialogDismiss>
				</div>
			</div>
		</header>
	)
}

export function PriceInput({
	value,
	onValueChange,
	placeholder = 'Price'
}: {
	value: string
	onValueChange: (canonical: string) => void
	placeholder?: string
}) {
	const [isFocused, setIsFocused] = useState(false)
	const [draft, setDraft] = useState(value)
	const display = isFocused ? draft : formatPriceDisplay(value)

	return (
		<div className="relative w-32">
			<span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-[#999]">$</span>
			<input
				type="text"
				inputMode="decimal"
				value={display}
				onFocus={() => {
					setIsFocused(true)
					setDraft(value)
				}}
				onBlur={() => setIsFocused(false)}
				onChange={(e) => {
					const rawValue = e.currentTarget.value
					const canonical = normalizePriceInput(rawValue)
					setDraft(rawValue)
					onValueChange(canonical)
				}}
				placeholder={placeholder}
				className={`${alertInputClass} pl-6`}
			/>
		</div>
	)
}

export function ToggleSwitch({
	checked,
	onClick,
	label,
	disabled
}: {
	checked: boolean
	onClick: () => void
	label: string
	disabled?: boolean
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={onClick}
			disabled={disabled}
			className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
				checked ? 'bg-(--link-text)' : 'bg-black/15 dark:bg-white/15'
			}`}
		>
			<span
				className={`absolute top-[3px] left-0 size-4 rounded-full bg-white shadow transition-transform duration-200 ${
					checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
				}`}
			/>
		</button>
	)
}

export function SegmentedToggle<T extends string>({
	value,
	onChange,
	options,
	disabled
}: {
	value: T
	onChange: (next: T) => void
	options: { value: T; label: string }[]
	disabled?: boolean
}) {
	return (
		<div className="flex w-fit items-center gap-0.5 rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.06]">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					disabled={disabled}
					onClick={() => onChange(option.value)}
					data-active={value === option.value}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-[#777] capitalize transition-colors hover:text-(--text-primary) disabled:opacity-50 data-[active=true]:bg-white data-[active=true]:text-(--link-text) data-[active=true]:shadow-[0_1px_2px_rgba(0,0,0,0.08)] data-[active=true]:ring-1 data-[active=true]:ring-black/[0.06] dark:text-[#919296] dark:hover:text-white dark:data-[active=true]:bg-white/[0.09] dark:data-[active=true]:shadow-none dark:data-[active=true]:ring-white/[0.08]"
				>
					{option.label}
				</button>
			))}
		</div>
	)
}

export function StatusChip({
	tone,
	children
}: {
	tone: 'success' | 'error' | 'neutral' | 'warning'
	children: ReactNode
}) {
	const toneClass =
		tone === 'success'
			? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
			: tone === 'error'
				? 'bg-red-500/10 text-red-600 dark:text-red-400'
				: tone === 'warning'
					? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
					: 'bg-black/[0.05] text-[#777] dark:bg-white/[0.07] dark:text-[#919296]'
	return (
		<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 label-xs capitalize ${toneClass}`}>
			{children}
		</span>
	)
}
