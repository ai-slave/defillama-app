import { focusNeighbourOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import type { ChartConfig, ChartType } from '../chartConfig'
import { ColorPicker } from './ColorPicker'

interface SeriesChipProps {
	name: string
	paletteColor: string
	chartType: ChartType
	config: ChartConfig
	onChange: (patch: Partial<ChartConfig>) => void
	onRemove: () => void
	dualAxisEligible: boolean
	seriesKindEligible: boolean
}

export function SeriesChip({
	name,
	paletteColor,
	chartType,
	config,
	onChange,
	onRemove,
	dualAxisEligible,
	seriesKindEligible
}: SeriesChipProps) {
	const color = config.seriesColors[name]
	const isRight = config.rightAxisCols.includes(name)
	const kind = config.seriesKinds[name] ?? (chartType === 'bar' ? 'bar' : 'line')

	const setColor = (next: string | null) => {
		const rest = { ...config.seriesColors }
		delete rest[name]
		onChange({ seriesColors: next == null ? rest : { ...rest, [name]: next } })
	}

	const toggleAxis = () => {
		onChange({
			rightAxisCols: isRight ? config.rightAxisCols.filter((n) => n !== name) : [...config.rightAxisCols, name]
		})
	}

	const toggleKind = () => {
		const rest = { ...config.seriesKinds }
		delete rest[name]
		const next = kind === 'line' ? 'bar' : 'line'
		onChange({ seriesKinds: { ...rest, [name]: next } })
	}

	return (
		<div data-row className="group flex items-center gap-1.5 rounded-md bg-hover-row px-1.5 py-0.5">
			<ColorPicker name={name} value={color} fallback={paletteColor} onChange={setColor} />
			<span className="truncate mono-sm text-primary" style={{ maxWidth: '14ch' }}>
				{name}
			</span>
			{seriesKindEligible ? (
				<Tooltip
					content={`Series type: ${kind}`}
					render={
						<button
							type="button"
							onClick={toggleKind}
							aria-label={`Series ${name} type: ${kind}`}
							className="touch-target hover-wash flex h-4 w-5 items-center justify-center rounded-sm border border-medium bg-page label-sm text-secondary hover:text-primary"
						/>
					}
				>
					{kind === 'line' ? '—' : '▮'}
				</Tooltip>
			) : null}
			{dualAxisEligible ? (
				<Tooltip
					content={`Axis: ${isRight ? 'right' : 'left'}`}
					render={
						<button
							type="button"
							onClick={toggleAxis}
							aria-label={`Use right axis for ${name}`}
							aria-pressed={isRight}
							className={`touch-target flex h-4 w-5 items-center justify-center rounded-sm border label-sm transition-colors ${
								isRight
									? 'border-brand bg-brand text-on-brand'
									: 'hover-wash border-medium bg-page text-secondary hover:text-primary'
							}`}
						/>
					}
				>
					{isRight ? 'R' : 'L'}
				</Tooltip>
			) : null}
			{/* Sized like the L/R and type toggles beside it. Touch cannot hover, so it always shows the remove. */}
			<Tooltip
				content="Remove"
				render={
					<button
						type="button"
						ref={focusNeighbourOnLeave()}
						onClick={onRemove}
						aria-label={`Remove ${name}`}
						className="touch-target flex h-4 w-5 items-center justify-center rounded-sm text-tertiary opacity-0 transition group-hover:opacity-100 hover:bg-hover-row hover:text-primary focus-visible:opacity-100 pointer-coarse:opacity-100"
					/>
				}
			>
				<Icon name="x" className="size-3" />
			</Tooltip>
		</div>
	)
}
