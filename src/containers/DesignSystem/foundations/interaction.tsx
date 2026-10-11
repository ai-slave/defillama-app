import { Button } from '~/ui/Button'
import { Cell, Example, type Foundation, NotApplicable, StateGrid } from '../shared'

/* Interaction states: the hover, pressed, focus, selected and disabled utilities and tokens, each forced. */

const SAMPLE = 'rounded-lg border border-medium px-3 py-1.5 label-sm text-primary'
const FILLED = `${SAMPLE} bg-surface-elevated-1`

function InteractionOverview() {
	return (
		<>
			<Example
				wide
				name="Washes"
				note="hover-row replaces the background and suits transparent rows; the three washes paint over the resting fill. Forced states; selected takes no wash."
			>
				<StateGrid
					columns={['Rest', 'Hover', 'Focus', 'Pressed', 'Selected']}
					rows={[
						[
							'hover:bg-hover-row',
							<>
								<button type="button" className={`${SAMPLE} hover:bg-hover-row active:bg-pressed-row`}>
									Row
								</button>
								<Cell force="hover">
									<button type="button" className={`${SAMPLE} hover:bg-hover-row`}>
										Row
									</button>
								</Cell>
								<Cell force="focus-visible">
									<button type="button" className={`${SAMPLE} focus-visible:bg-hover-row`}>
										Row
									</button>
								</Cell>
								<Cell force="active">
									<button type="button" className={`${SAMPLE} active:bg-pressed-row`}>
										Row
									</button>
								</Cell>
								<NotApplicable />
							</>
						],
						[
							'hover-wash',
							<>
								<button type="button" className={`${FILLED} hover-wash`}>
									Wash
								</button>
								<Cell force="hover">
									<button type="button" className={`${FILLED} hover-wash`}>
										Wash
									</button>
								</Cell>
								<Cell force="focus-visible">
									<button type="button" className={`${FILLED} hover-wash`}>
										Wash
									</button>
								</Cell>
								<Cell force="active">
									<button type="button" className={`${FILLED} hover-wash`}>
										Wash
									</button>
								</Cell>
								<button type="button" className={`${FILLED} hover-wash bg-brand-muted`} data-active="true">
									Wash
								</button>
							</>
						],
						[
							'hover-wash-card',
							<>
								<button type="button" className={`${FILLED} hover-wash-card`}>
									Card
								</button>
								<Cell force="hover">
									<button type="button" className={`${FILLED} hover-wash-card`}>
										Card
									</button>
								</Cell>
								<Cell force="focus-visible">
									<button type="button" className={`${FILLED} hover-wash-card`}>
										Card
									</button>
								</Cell>
								<NotApplicable />
								<NotApplicable />
							</>
						],
						[
							'press-wash',
							<>
								<button type="button" className={`${FILLED} press-wash`}>
									Press
								</button>
								<NotApplicable />
								<NotApplicable />
								<Cell force="active">
									<button type="button" className={`${FILLED} press-wash`}>
										Press
									</button>
								</Cell>
								<NotApplicable />
							</>
						],
						[
							'group-hover-wash',
							<>
								<span className="group flex rounded-lg">
									<span className={`${FILLED} group-hover-wash`}>Cell</span>
								</span>
								<Cell force="hover">
									<span className="group flex rounded-lg">
										<span className={`${FILLED} group-hover-wash`}>Cell</span>
									</span>
								</Cell>
								<NotApplicable />
								<NotApplicable />
								<NotApplicable />
							</>
						]
					]}
				/>
			</Example>
			<Example
				name="Focus ring"
				note="The global :focus-visible rule draws the ring; focus-ring applies it by class (Ariakit virtual focus), focus-ring-on-brand on a solid brand fill."
			>
				<StateGrid
					columns={['focus-visible', 'Utility']}
					rows={[
						[
							'Default',
							<>
								<Cell force="focus-visible">
									<button type="button" className={FILLED}>
										Focus
									</button>
								</Cell>
								<span className={`${FILLED} focus-ring`}>focus-ring</span>
							</>
						],
						[
							'On brand',
							<>
								<Cell force="focus-visible">
									<Button variant="primary" size="md">
										Focus
									</Button>
								</Cell>
								<span className={`${SAMPLE} bg-brand text-on-brand focus-ring-on-brand`}>focus-ring-on-brand</span>
							</>
						]
					]}
				/>
			</Example>
			<Example
				name="Selected, disabled, busy"
				note="Selected is bg-brand-muted on data-active; disabled uses the disabled tokens and a Button keeps its fill on hover; opacity-60 is the dimmed tile in src/ui/UploadTile.tsx; aria-busy keeps full color with cursor-progress."
			>
				<StateGrid
					columns={['Rest', 'Selected', 'Disabled', 'Dimmed', 'Busy']}
					rows={[
						[
							'Utility',
							<>
								<button type="button" className={`${FILLED} hover-wash`}>
									Option
								</button>
								<button type="button" className={`${SAMPLE} bg-brand-muted text-link`} data-active="true">
									Option
								</button>
								<button type="button" disabled className={`${SAMPLE} border-disabled bg-disabled text-disabled`}>
									Option
								</button>
								<button type="button" aria-disabled="true" className={`${FILLED} opacity-60`}>
									Option
								</button>
								<button type="button" aria-busy="true" className={`${FILLED} cursor-progress`}>
									Option
								</button>
							</>
						],
						[
							'Button',
							<>
								<Button variant="secondary" size="md">
									Option
								</Button>
								<Button variant="toggle" size="md" data-active="true">
									Option
								</Button>
								<Button variant="secondary" size="md" disabled>
									Option
								</Button>
								<NotApplicable />
								<Button variant="secondary" size="md" pending pendingLabel="Saving…">
									Save
								</Button>
							</>
						]
					]}
				/>
			</Example>
		</>
	)
}

export const interactionStates: Foundation = {
	id: 'interaction-states',
	name: 'Interaction states',
	source: 'src/styles/semantics.css',
	overview: InteractionOverview
}
