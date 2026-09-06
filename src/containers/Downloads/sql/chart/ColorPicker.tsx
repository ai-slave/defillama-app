import * as Ariakit from '@ariakit/react'
import { useId, useState } from 'react'
import { CHART_COLORS } from '~/constants/colors'

interface ColorPickerProps {
	name: string
	value: string | undefined
	fallback: string
	onChange: (next: string | null) => void
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function ColorPicker({ name, value, fallback, onChange }: ColorPickerProps) {
	const id = useId()
	const [draft, setDraft] = useState('')
	const active = value ?? fallback

	return (
		<Ariakit.PopoverProvider placement="bottom-start">
			<Ariakit.PopoverDisclosure
				aria-label={`Color for ${name}`}
				className="size-3 shrink-0 rounded-sm border border-subtle shadow-sm transition-transform hover:scale-110"
				style={{ background: active }}
			/>
			<Ariakit.Popover
				portal
				aria-label={`Color for ${name}`}
				gutter={6}
				className="z-50 flex flex-col gap-2 rounded-lg border border-medium bg-surface-elevated-1 p-2 shadow-lg"
			>
				<Ariakit.RadioProvider value={active.toLowerCase()} orientation="both">
					<Ariakit.RadioGroup aria-label="Preset colors" className="grid grid-cols-5 gap-1">
						{CHART_COLORS.map((c) => (
							<label
								key={c}
								htmlFor={`${id}-${c}`}
								aria-label={c}
								className={`relative size-4 cursor-pointer rounded-sm border transition-transform hover:scale-110 has-focus-visible:focus-ring ${active.toLowerCase() === c.toLowerCase() ? 'border-pro-text-primary ring-1 ring-brand' : 'border-subtle'}`}
								style={{ background: c }}
							>
								<Ariakit.Radio
									id={`${id}-${c}`}
									value={c.toLowerCase()}
									aria-label={c}
									onChange={() => onChange(c)}
									className="sr-only"
								/>
							</label>
						))}
					</Ariakit.RadioGroup>
				</Ariakit.RadioProvider>
				<div className="flex items-center gap-1">
					<input
						type="text"
						aria-label={`Custom color for ${name}`}
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onBlur={() => {
							if (HEX_RE.test(draft.trim())) onChange(draft.trim())
						}}
						placeholder="#2f73c6"
						className="w-20 rounded-sm border border-subtle bg-pro-app-bg px-1.5 py-0.5 font-mono text-[10.5px] text-pro-text-primary focus:border-brand focus:outline-hidden"
					/>
					<button
						type="button"
						onClick={() => onChange(null)}
						className="rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] text-pro-text-tertiary hover:bg-hover-row hover:text-pro-text-primary"
					>
						reset
					</button>
				</div>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}
