import * as Ariakit from '@ariakit/react'
import { useId, type ReactNode } from 'react'

export function MetaSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		// A long settings sheet reads as groups only when the gap between them beats the gap inside them.
		<section className="grid gap-3 border-t border-subtle pt-5 first:border-t-0 first:pt-0">
			<h3 className="label-md text-primary">{title}</h3>
			{children}
		</section>
	)
}

export function MetaSwitch({
	checked,
	onCheckedChange,
	label,
	description
}: {
	checked: boolean
	onCheckedChange: (next: boolean) => void
	label: string
	description?: string
}) {
	const id = useId()
	return (
		<label className="group flex cursor-pointer items-start justify-between gap-4 rounded-md border border-transparent px-3 py-2.5 transition-colors hover:border-medium hover:bg-hover-row">
			<span className="grid min-w-0 gap-0.5">
				<span id={`${id}-label`} className="label-md text-primary">
					{label}
				</span>
				{description ? (
					<span id={`${id}-description`} className="body-sm text-tertiary">
						{description}
					</span>
				) : null}
			</span>
			<Ariakit.Checkbox
				checked={checked}
				onChange={(event) => onCheckedChange(event.currentTarget.checked)}
				role="switch"
				aria-checked={checked}
				aria-labelledby={`${id}-label`}
				aria-describedby={description ? `${id}-description` : undefined}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				// The shared Switch's track and knob (src/ui/Switch.tsx); this row keeps its own label and description.
				className={`relative h-6 w-10 shrink-0 rounded-full p-1 ${
					checked
						? 'bg-brand peer-focus-visible:focus-ring-on-brand'
						: 'bg-surface-elevated-2 peer-focus-visible:focus-ring'
				}`}
			>
				<span
					className={`block size-4 rounded-full bg-white shadow-raised motion-safe:transition-transform motion-safe:duration-150 ${checked ? 'translate-x-4' : ''}`}
				/>
			</span>
		</label>
	)
}

export function MetaFieldHint({ children }: { children: ReactNode }) {
	return <p className="body-sm text-tertiary">{children}</p>
}
