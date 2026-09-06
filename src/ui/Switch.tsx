import type { ChangeEventHandler } from 'react'
import { LoadingSpinner } from '~/ui/Loaders'
import { QuestionHelper } from '~/ui/QuestionHelper'

/* ----------------------------------------------------------------------------
   Switch — design.md form-control recipe (Figma node 6298:54913).
   40x24 rounded-full track, 16px knob; on = bg-brand, off = elevated-2.
   Label is label-sm at gap-2.
---------------------------------------------------------------------------- */

export function Switch({
	label,
	checked,
	onChange,
	value,
	className,
	help,
	isLoading
}: {
	label: string
	checked: boolean
	onChange: ChangeEventHandler<HTMLInputElement>
	value: string
	className?: string
	help?: string
	isLoading?: boolean
}) {
	return (
		<label
			className={`relative isolate flex cursor-pointer flex-nowrap items-center gap-2 label-sm ${className ?? ''}`}
		>
			<input
				type="checkbox"
				value={value}
				checked={checked}
				onChange={onChange}
				className="peer absolute size-[1em] opacity-[0.00001]"
			/>
			<span
				className={`h-6 w-10 shrink-0 rounded-full p-1 transition-colors ${checked ? 'bg-brand peer-focus-visible:focus-ring-on-brand' : 'bg-surface-elevated-2 peer-focus-visible:focus-ring'}`}
			>
				<span
					className={`block size-4 rounded-full bg-white shadow-xs transition-transform ${checked ? 'translate-x-4' : ''}`}
				/>
			</span>
			{help ? (
				<span className="flex items-center gap-1">
					<span>{label}</span>
					<QuestionHelper text={help} />
				</span>
			) : (
				<span>{label}</span>
			)}

			{isLoading ? (
				<span className="absolute top-0 right-0 bottom-0 left-0 z-10 flex items-center rounded-md bg-white/80 pl-0.75 dark:bg-black/80">
					<LoadingSpinner size={12} />
				</span>
			) : null}
		</label>
	)
}
