import { useId, type ReactNode } from 'react'
import { Switch } from '~/ui/Switch'

export function MetaSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		// A long settings sheet reads as groups only when the gap between them beats the gap inside them.
		<section className="grid gap-3 border-t border-subtle pt-5 first:border-t-0 first:pt-0">
			<h3 className="label-md text-primary">{title}</h3>
			{children}
		</section>
	)
}

/** A settings row: its label and description on the left, the shared Switch on the right, named by the label and
    described by the description. */
export function MetaSwitch({
	checked,
	onCheckedChange,
	label,
	description
}: {
	checked: boolean
	onCheckedChange: (next: boolean) => void
	label: string
	description: string
}) {
	const descriptionId = useId()
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="grid min-w-0 gap-0.5">
				<span className="label-md text-primary">{label}</span>
				<span id={descriptionId} className="body-sm text-tertiary">
					{description}
				</span>
			</span>
			<Switch
				label={label}
				hideLabel
				value={label}
				checked={checked}
				onChange={(event) => onCheckedChange(event.currentTarget.checked)}
				describedBy={descriptionId}
				className="shrink-0"
			/>
		</div>
	)
}

export function MetaFieldHint({ children }: { children: ReactNode }) {
	return <p className="body-sm text-tertiary">{children}</p>
}
