import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { BasicLink } from '~/components/Link'
import { formatPriceDisplay, normalizePriceInput } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { useTipActions } from '~/containers/LlamaAI/components/TipActionContext'
import { Icon, type IIcon } from '~/ui/Icon'

const settingsIntegrationsLinkClass =
	'cursor-pointer underline decoration-dotted underline-offset-2 transition-colors hover:text-link'

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
	'dialog max-h-[85vh] w-full max-w-lg gap-0 overflow-hidden rounded-2xl border border-ai-line-subtle bg-ai-surface-card p-0 shadow-ai-lg max-sm:max-h-[calc(100dvh-80px)] max-sm:rounded-b-none'

export const alertBackdropClass = 'backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-md'

export const alertInputClass =
	'w-full rounded-lg border border-ai-line-medium bg-ai-hover-faint px-3 py-2 text-sm text-ai-primary placeholder-ai-muted transition-all outline-hidden focus:border-link/40 focus:bg-ai-hover focus:ring-4 focus:ring-link/8'

export const alertSelectClass =
	'rounded-lg border border-ai-line-medium bg-ai-hover-faint px-2.5 py-2 text-sm text-ai-primary transition-all outline-hidden focus:border-link/40 focus:bg-ai-surface-card focus:ring-4 focus:ring-link/8'

export const alertFieldLabelClass = 'text-xs font-medium text-ai-tertiary'

export const alertPrimaryButtonClass =
	'flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-ai-white transition-colors hover:bg-ai-action-hover disabled:cursor-not-allowed disabled:opacity-50'

export const alertGhostButtonClass =
	'rounded-lg px-3 py-2 text-sm text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary'

export const alertIconButtonClass =
	'flex size-7 items-center justify-center rounded-lg text-ai-muted transition-colors hover:bg-ai-hover hover:text-primary dark:hover:text-ai-primary'

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
		<header className="relative shrink-0 overflow-hidden border-b border-ai-line-subtle">
			<div className="from-ai-warning-bright/0.06 pointer-events-none absolute inset-0 bg-linear-to-br via-transparent to-transparent" />
			<div className="relative flex items-center justify-between gap-3 px-5 py-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-ai-warning-bright/20 to-ai-warning-bright/5 ring-1 ring-ai-warning-bright/20 ring-inset">
						<Icon name={icon} className="size-4 text-ai-warning-bright" />
					</div>
					<div className="flex min-w-0 flex-col leading-tight">
						<h2 className="m-0 text-base font-semibold tracking-tight text-ai-primary">{title}</h2>
						{subtitle ? <p className="m-0 mt-0.5 truncate text-xs text-ai-tertiary">{subtitle}</p> : null}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					{right}
					<Ariakit.DialogDismiss className="rounded-lg p-2 text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary">
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
			<span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-ai-muted">$</span>
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
				checked ? 'bg-link' : 'bg-ai-black/15 dark:bg-ai-white/15'
			}`}
		>
			<span
				className={`absolute top-[3px] left-0 size-4 rounded-full bg-ai-white shadow transition-transform duration-200 ${
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
	options: Array<{ value: T; label: string }>
	disabled?: boolean
}) {
	return (
		<div className="flex w-fit items-center gap-0.5 rounded-lg bg-ai-hover p-0.5">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					disabled={disabled}
					onClick={() => onChange(option.value)}
					data-active={value === option.value}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-ai-tertiary capitalize transition-colors hover:text-primary disabled:opacity-50 data-[active=true]:bg-ai-white data-[active=true]:text-link data-[active=true]:shadow-ai-xs data-[active=true]:ring-1 data-[active=true]:ring-ai-line-subtle dark:hover:text-ai-primary dark:data-[active=true]:bg-ai-hover-strong dark:data-[active=true]:shadow-none dark:data-[active=true]:ring-ai-line-medium"
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
			? 'bg-ai-success/10 text-ai-success'
			: tone === 'error'
				? 'bg-ai-error-vivid/10 text-ai-error'
				: tone === 'warning'
					? 'bg-ai-warning-bright/10 text-ai-warning'
					: 'bg-ai-hover text-ai-tertiary'
	return (
		<span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 label-xs capitalize ${toneClass}`}>
			{children}
		</span>
	)
}
