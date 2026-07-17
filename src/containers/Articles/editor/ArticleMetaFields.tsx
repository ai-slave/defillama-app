import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'

export function MetaSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="grid gap-3">
			<h3 className="text-[10px] font-medium tracking-[0.18em] text-tertiary uppercase">{title}</h3>
			{children}
		</section>
	)
}

export function MetaSwitch({
	checked,
	onCheckedChange,
	label,
	description,
	disabled
}: {
	checked: boolean
	onCheckedChange: (next: boolean) => void
	label: string
	description?: string
	disabled?: boolean
}) {
	return (
		<label
			className={`group flex items-start justify-between gap-4 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-medium hover:bg-page/40 ${
				disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
			}`}
		>
			<span className="grid min-w-0 gap-0.5">
				<span className="text-sm font-medium text-primary">{label}</span>
				{description ? <span className="text-[11px] leading-snug text-tertiary">{description}</span> : null}
			</span>
			<Ariakit.Checkbox
				checked={checked}
				onChange={(event) => onCheckedChange(event.currentTarget.checked)}
				disabled={disabled}
				render={(props) => (
					<button
						{...props}
						type="button"
						role="switch"
						aria-checked={checked}
						className={`relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-link/40 focus-visible:ring-offset-1 focus-visible:ring-offset-(--pro-cards-bg) focus-visible:outline-hidden ${
							checked ? 'border-link/60 bg-link' : 'border-medium bg-page group-hover:border-tertiary'
						}`}
					>
						<span
							className={`absolute top-1/2 inline-block size-3 -translate-y-1/2 rounded-full shadow-sm transition-all duration-200 ease-out ${
								checked ? 'left-[15px] bg-white' : 'left-[2px] bg-tertiary group-hover:bg-secondary'
							}`}
						/>
					</button>
				)}
			/>
		</label>
	)
}

export function MetaFieldHint({ children, error }: { children?: ReactNode; error?: string | null }) {
	if (error) {
		return (
			<span className="flex items-center gap-1.5 text-[11px] text-error">
				<span aria-hidden className="inline-block size-1 rounded-full bg-error" />
				{error}
			</span>
		)
	}
	if (!children) return null
	return <span className="text-[11px] leading-snug text-tertiary">{children}</span>
}
