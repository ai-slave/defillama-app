import { useState } from 'react'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { TablePager } from '~/components/Table/TablePager'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Logo } from '~/ui/Logo'
import { SearchField } from '~/ui/SearchField'
import { Select } from '~/ui/Select'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { DEMO_LOGO } from '../demoAssets'
import { Cell, Example, type Family, type KnobValues, REST_HOVER_FOCUS, StateGrid } from '../shared'

const CHAINS = ['All chains', 'Ethereum', 'Arbitrum', 'Base', 'Solana']

function TableToolbarDemo({ divided }: { divided: boolean }) {
	const [chain, setChain] = useState('Ethereum')
	const [search, setSearch] = useState('aave')
	return (
		<div className="w-full max-w-3xl">
			<Card padding="none">
				<TableToolbar divided={divided}>
					<h4 className="mr-auto label-md">Protocols</h4>
					<SearchField
						label="Search protocols"
						placeholder="Search protocols"
						value={search}
						onChange={setSearch}
						width="inline"
					/>
					<TableToolbarControlGroup>
						<Select
							label="Chain"
							allValues={CHAINS}
							selectedValues={chain}
							setSelectedValues={setChain}
							variant="filter"
							size="md"
						/>
						<Button size="md">.csv</Button>
					</TableToolbarControlGroup>
				</TableToolbar>
				{/* A stand-in for the table head the rule separates from the toolbar. */}
				<div className="grid grid-cols-[1fr_6rem_6rem] px-3 py-2 label-sm text-tertiary">
					<span>Name</span>
					<span className="text-right">TVL</span>
					<span className="text-right">1d change</span>
				</div>
			</Card>
		</div>
	)
}

function ResponsiveFilterLayoutDemo() {
	const [filterChain, setFilterChain] = useState('Ethereum')
	return (
		<div className="w-full max-w-3xl">
			<ResponsiveFilterLayout>
				{(nestedMenu) => (
					<>
						<Select
							nestedMenu={nestedMenu}
							label="Chain"
							allValues={CHAINS}
							selectedValues={filterChain}
							setSelectedValues={setFilterChain}
							variant="filter"
							size="md"
						/>
						<ResetFiltersButton
							nestedMenu={nestedMenu}
							disabled={filterChain === 'Ethereum'}
							onClick={() => setFilterChain('Ethereum')}
						>
							Reset filters
						</ResetFiltersButton>
					</>
				)}
			</ResponsiveFilterLayout>
		</div>
	)
}

const PAGE_INDEX = { middle: 8, first: 0, last: 16 }
const ROWS_PER_PAGE = 20
const TOTAL_ROWS = 340

function pagerDemo(values: KnobValues) {
	const pageIndex = PAGE_INDEX[values.page as keyof typeof PAGE_INDEX]
	return (
		<div className="w-full max-w-2xl">
			<TablePager
				pageIndex={pageIndex}
				pageCount={17}
				onPageChange={() => {}}
				disabled={values.disabled === true}
				range={
					values.range
						? { from: pageIndex * ROWS_PER_PAGE + 1, to: (pageIndex + 1) * ROWS_PER_PAGE, total: TOTAL_ROWS }
						: undefined
				}
				pageSize={values.pageSize ? { value: ROWS_PER_PAGE, options: [20, 50, 100], onChange: () => {} } : undefined}
			/>
		</div>
	)
}

export const tables: Family = {
	id: 'tables',
	title: 'Tables',
	parts: [
		{
			name: 'ResponsiveFilterLayout',
			source: 'src/components/Filters/ResponsiveFilterLayout.tsx',
			note: 'Below sm the same filters render inside one Filters menu (NestedMenu), where the reset is its closing action row; that menu opens only on a phone.',
			render: () => <ResponsiveFilterLayoutDemo />
		},
		{
			name: 'ResetFiltersButton',
			source: 'src/components/Filters/ResetFiltersButton.tsx',
			knobs: [
				{ name: 'nestedMenu', boolean: true, required: true },
				{ name: 'state', values: ['enabled', 'disabled'], default: 'enabled', prop: false }
			],
			note: "With nestedMenu on it is the phone menu's closing action row, drawn here outside its menu. It is disabled while nothing is filtered.",
			render: (values) => {
				const nestedMenu = values.nestedMenu === true
				return (
					<div className={nestedMenu ? 'w-48' : undefined}>
						<ResetFiltersButton nestedMenu={nestedMenu} disabled={values.state === 'disabled'}>
							Reset filters
						</ResetFiltersButton>
					</div>
				)
			}
		},
		{
			name: 'TableToolbar',
			source: 'src/ui/Toolbar.tsx',
			knobs: [{ name: 'divided', boolean: true }],
			note: 'The title takes the free space (mr-auto), the search keeps 280px, and a TableToolbarControlGroup keeps its controls together when the row wraps. Turn divided on: a rule separates the row from the table head under it.',
			render: (values) => <TableToolbarDemo divided={values.divided === true} />
		},
		{
			name: 'TablePager',
			source: 'src/components/Table/TablePager.tsx',
			knobs: [
				{ name: 'page', values: ['middle', 'first', 'last'], default: 'middle', prop: false },
				{ name: 'range', boolean: true, prop: false },
				{ name: 'pageSize', boolean: true, prop: false },
				{ name: 'disabled', boolean: true }
			],
			note: 'The page knob sets pageIndex; the buttons do not move it. First and last disable the buttons toward that end.',
			render: pagerDemo
		},
		{
			name: 'TextLink',
			source: 'src/ui/TextLink.tsx',
			knobs: [
				{ name: 'size', values: ['md', 'sm', 'inherit'], default: 'md' },
				{ name: 'truncate', boolean: true }
			],
			note: 'Drawn in a 160px cell, so truncate ends the long name with an ellipsis. Hover it or Tab to it: it underlines.',
			render: (values) => (
				<span className="flex w-40">
					<TextLink
						href="/protocol/aave-v3"
						size={values.size as 'md' | 'sm' | 'inherit'}
						truncate={values.truncate === true}
					>
						Aave V3 lending markets
					</TextLink>
				</span>
			),
			states: () => (
				<>
					<Example name="Interaction">
						<StateGrid
							columns={['Rest', 'Hover', 'Focus']}
							rows={[
								[
									'link',
									<>
										{REST_HOVER_FOCUS.map((force) => (
											<Cell key={force ?? 'rest'} force={force}>
												<TextLink href="/protocol/aave-v3">Aave V3</TextLink>
											</Cell>
										))}
									</>
								]
							]}
						/>
					</Example>
					<Example
						name="In a table cell"
						note="The logo sits beside the link, never inside it, so the link's name is the protocol's name."
					>
						<span className="flex w-48 items-center gap-2">
							<Logo src={DEMO_LOGO} size={20} />
							<TextLink href="/protocol/aave-v3" truncate>
								Aave V3 lending markets
							</TextLink>
						</span>
					</Example>
				</>
			)
		}
	]
}
