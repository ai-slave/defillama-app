import { type ReactNode, useState } from 'react'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { Field, FieldGroup } from '~/ui/Field'
import { Input, Textarea } from '~/ui/Input'
import { SearchField } from '~/ui/SearchField'
import { Cell, Example, type Family, type KnobValues, StateGrid } from '../shared'

const FIELD_STATES = ['Rest', 'Hover', 'Focus', 'Invalid', 'Disabled', 'Locked', 'Saving'] as const

const FIELD_STATE_VALUES = ['rest', 'invalid', 'disabled', 'locked', 'saving'] as const
// The props each state sets, shared by the playground and the Variant × state matrices so the two agree.
const FIELD_STATE_PROPS: Record<(typeof FIELD_STATE_VALUES)[number], Record<string, unknown>> = {
	rest: {},
	invalid: { 'aria-invalid': true },
	disabled: { disabled: true },
	locked: { readOnly: true, 'aria-disabled': true },
	saving: { readOnly: true, 'aria-busy': true }
}

function fieldRow(make: (props: Record<string, unknown>) => ReactNode): ReactNode {
	return (
		<>
			<Cell>{make(FIELD_STATE_PROPS.rest)}</Cell>
			<Cell force="hover">{make(FIELD_STATE_PROPS.rest)}</Cell>
			<Cell force="focus">{make(FIELD_STATE_PROPS.rest)}</Cell>
			<Cell>{make(FIELD_STATE_PROPS.invalid)}</Cell>
			<Cell>{make(FIELD_STATE_PROPS.disabled)}</Cell>
			<Cell>{make(FIELD_STATE_PROPS.locked)}</Cell>
			<Cell>{make(FIELD_STATE_PROPS.saving)}</Cell>
		</>
	)
}

const INPUT_VARIANTS = ['text', 'code', 'oneTimeCode', 'inline'] as const
type InputVariant = (typeof INPUT_VARIANTS)[number]
const INPUT_DEMO: Record<InputVariant, { placeholder?: string; defaultValue?: string }> = {
	text: { placeholder: 'Dashboard name' },
	code: { defaultValue: '0x5f98…a1c4' },
	oneTimeCode: { placeholder: '000000' },
	inline: { defaultValue: 'Untitled query' }
}

function InputDemo({ values }: { values: KnobValues }) {
	const variant = values.variant as InputVariant
	const input = (
		<Input
			variant={variant}
			aria-label="Value"
			className={variant === 'inline' ? 'w-40' : 'w-56'}
			{...INPUT_DEMO[variant]}
			{...FIELD_STATE_PROPS[values.state as keyof typeof FIELD_STATE_PROPS]}
		/>
	)
	// A rename in place lives on a card or in a dense row, never on a bare surface.
	return variant === 'inline' ? (
		<Card padding="sm" className="flex w-72 items-center gap-2">
			{input}
		</Card>
	) : (
		input
	)
}

function SearchFieldDemo({ values }: { values: KnobValues }) {
	const [search, setSearch] = useState('aave')
	return (
		<div className="contents" data-anatomy="SearchField">
			<SearchField
				data-anatomy="Input"
				label="Search protocols"
				placeholder="Search protocols"
				value={search}
				onChange={setSearch}
				disabled={values.state === 'disabled'}
				className="w-56"
			/>
		</div>
	)
}

function SearchFieldPlacement() {
	const [search, setSearch] = useState('aave')
	return (
		<Example name="Placement" prop="width">
			<div className="flex w-96 flex-col gap-4">
				<div className="flex flex-col gap-1">
					<span className="mono-sm text-tertiary">width="standalone"</span>
					<div className="flex items-center gap-2">
						<SearchField
							label="Search protocols"
							placeholder="Search protocols"
							value={search}
							onChange={setSearch}
							width="standalone"
						/>
						<Button size="md">.csv</Button>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<span className="mono-sm text-tertiary">width="inline"</span>
					<div className="flex items-center justify-end gap-2">
						<SearchField
							label="Search protocols"
							placeholder="Search protocols"
							value={search}
							onChange={setSearch}
							width="inline"
						/>
						<Button size="md">.csv</Button>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					<span className="mono-sm text-tertiary">width="flexible"</span>
					<div className="flex items-center gap-2">
						<SearchField
							label="Search protocols"
							placeholder="Search protocols"
							value={search}
							onChange={setSearch}
							width="flexible"
						/>
						<Button size="md">.csv</Button>
					</div>
				</div>
			</div>
		</Example>
	)
}

export const fields: Family = {
	id: 'fields',
	title: 'Fields',
	parts: [
		{
			name: 'Input',
			source: 'src/ui/Input.tsx',
			knobs: [
				{ name: 'variant', values: INPUT_VARIANTS, default: 'text' },
				{ name: 'state', values: FIELD_STATE_VALUES, default: 'rest', prop: false }
			],
			note: 'Locked is readOnly + aria-disabled; Saving is readOnly + aria-busy.',
			render: (values) => <InputDemo values={values} />,
			states: () => (
				<>
					<Example wide name="Variant × state" note="Below sm in a dialog sheet every field is 44px (phone only).">
						<StateGrid
							columns={FIELD_STATES}
							rows={[
								[
									'placeholder',
									fieldRow((p) => <Input aria-label="Name" placeholder="Dashboard name" className="w-44" {...p} />)
								],
								['value', fieldRow((p) => <Input aria-label="Name" defaultValue="Lending" className="w-44" {...p} />)],
								[
									'variant="code"',
									fieldRow((p) => (
										<Input variant="code" aria-label="Address" defaultValue="0x5f98…a1c4" className="w-44" {...p} />
									))
								],
								[
									'prefix',
									fieldRow((p) => (
										<Input prefix="/research/" aria-label="Slug" defaultValue="aave-v4" className="w-56" {...p} />
									))
								],
								[
									'suffix',
									fieldRow((p) => <Input suffix="%" aria-label="Share" defaultValue="12.5" className="w-32" {...p} />)
								]
							]}
						/>
					</Example>
					<Example name="Prefix, suffix and type" prop="prefix, suffix, type">
						<div className="flex flex-col items-start gap-3">
							<Input prefix="/research/" aria-label="Slug" defaultValue="aave-v4" className="w-56" />
							<Input suffix="%" aria-label="Share" defaultValue="12.5" className="w-32" />
							<Input type="date" aria-label="Start date" defaultValue="2026-10-08" className="w-44 cursor-pointer" />
						</div>
					</Example>
					<Example name="One-time code in a Field" prop='variant="oneTimeCode"'>
						<div className="w-72">
							<Field label="Code">
								{(control) => <Input {...control} variant="oneTimeCode" placeholder="000000" />}
							</Field>
						</div>
					</Example>
				</>
			)
		},
		{
			name: 'Textarea',
			source: 'src/ui/Input.tsx',
			knobs: [
				{ name: 'variant', values: ['prose', 'code'], default: 'prose' },
				{ name: 'state', values: FIELD_STATE_VALUES, default: 'rest', prop: false }
			],
			render: (values) => (
				<Textarea
					variant={values.variant as 'prose' | 'code'}
					aria-label="Notes"
					rows={2}
					className="w-56"
					{...(values.variant === 'code' ? { defaultValue: 'select * from fees' } : { placeholder: 'Notes' })}
					{...FIELD_STATE_PROPS[values.state as keyof typeof FIELD_STATE_PROPS]}
				/>
			),
			states: () => (
				<Example wide name="Variant × state">
					<StateGrid
						columns={FIELD_STATES}
						rows={[
							[
								'prose',
								fieldRow((p) => <Textarea aria-label="Notes" rows={2} placeholder="Notes" className="w-44" {...p} />)
							],
							[
								'code',
								fieldRow((p) => (
									<Textarea
										variant="code"
										aria-label="Query"
										rows={2}
										defaultValue="select * from fees"
										className="w-44"
										{...p}
									/>
								))
							]
						]}
					/>
				</Example>
			)
		},
		{
			name: 'Field',
			source: 'src/ui/Field.tsx',
			knobs: [{ name: 'state', values: ['rest', 'hint', 'error'], default: 'rest', prop: false }],
			render: (values) => (
				<div className="w-72">
					<Field
						label="Email"
						hint={values.state === 'hint' ? 'We send the code here.' : undefined}
						error={values.state === 'error' ? 'Enter a valid email address.' : undefined}
					>
						{(control) => <Input {...control} type="email" defaultValue="name@example.com" />}
					</Field>
				</div>
			),
			states: () => (
				<>
					<Example name="Hint and error together" prop="hint, error">
						<div className="w-72">
							<Field label="Email" hint="We send the code here." error="Enter a valid email address.">
								{(control) => <Input {...control} type="email" defaultValue="name@example" />}
							</Field>
						</div>
					</Example>
					<Example name="Action" prop="action">
						<div className="w-72">
							<Field
								label="Password"
								action={
									<Button variant="link" type="button">
										Forgot password?
									</Button>
								}
							>
								{(control) => <Input {...control} type="password" defaultValue="hunter22" />}
							</Field>
						</div>
					</Example>
				</>
			)
		},
		{
			name: 'FieldGroup',
			source: 'src/ui/Field.tsx',
			knobs: [{ name: 'state', values: ['rest', 'error'], default: 'rest', prop: false }],
			render: (values) => (
				<div className="w-72">
					<FieldGroup label="Delivery" error={values.state === 'error' ? 'Choose at least one channel.' : undefined}>
						<div className="flex gap-3">
							<Checkbox variant="inline" checked={false} onChange={() => {}}>
								Email
							</Checkbox>
							<Checkbox variant="inline" checked={false} onChange={() => {}}>
								Telegram
							</Checkbox>
						</div>
					</FieldGroup>
				</div>
			)
		},
		{
			name: 'SearchField',
			source: 'src/ui/SearchField.tsx',
			knobs: [{ name: 'state', values: ['rest', 'disabled'], default: 'rest', prop: false }],
			note: 'Type to see the × appear; it clears and returns focus to the field.',
			render: (values) => <SearchFieldDemo values={values} />,
			anatomy: true,
			states: () => <SearchFieldPlacement />
		}
	]
}
