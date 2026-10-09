import * as Ariakit from '@ariakit/react'
import { useId, useState } from 'react'
import { CHART_COLORS } from '~/constants/colors'
import { Button } from '~/ui/Button'
import { Input } from '~/ui/Input'
import { PopoverSurface } from '~/ui/PopoverSurface'

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
				className="size-3 shrink-0 rounded-sm border border-medium shadow-raised transition-transform hover:scale-110"
				style={{ background: active }}
			/>
			<PopoverSurface variant="panel" heading={`Color for ${name}`} aria-label={`Color for ${name}`}>
				<div className="flex flex-col gap-2 p-2">
					<Ariakit.RadioProvider value={active.toLowerCase()} orientation="both">
						<Ariakit.RadioGroup aria-label="Preset colors" className="grid grid-cols-5 gap-1">
							{CHART_COLORS.map((c) => (
								<label
									key={c}
									htmlFor={`${id}-${c}`}
									aria-label={c}
									className={`relative size-4 cursor-pointer rounded-sm border transition-transform hover:scale-110 has-focus-visible:focus-ring ${active.toLowerCase() === c.toLowerCase() ? 'border-(--text-primary) ring-1 ring-brand' : 'border-medium'}`}
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
					<div className="flex items-center gap-2 label-sm">
						<Input
							type="text"
							aria-label={`Custom color for ${name}`}
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onBlur={() => {
								if (HEX_RE.test(draft.trim())) onChange(draft.trim())
							}}
							placeholder="#2f73c6"
							variant="code"
							className="w-24"
						/>
						<Button variant="link" onClick={() => onChange(null)}>
							Reset
						</Button>
					</div>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}
