import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import type { GroupBase, MenuListProps, MultiValue } from 'react-select'
import { ReactSelect } from '~/components/MultiSelect/ReactSelect'
import { Icon } from '~/ui/Icon'
import { reactSelectStyles } from '../utils/reactSelectStyles'

interface CategoryFilterModalProps {
	isOpen: boolean
	onClose: () => void
	onApply: (include: Array<string>, exclude: Array<string>) => void
	onClear: () => void
	categories: Array<string>
	initialInclude: Array<string>
	initialExclude: Array<string>
}

interface CategoryOption {
	value: string
	label: string
}

function SimpleMenuList(props: MenuListProps<CategoryOption, true, GroupBase<CategoryOption>>) {
	return (
		<div
			style={{
				maxHeight: props.maxHeight,
				overflowY: 'auto'
			}}
		>
			{props.children}
		</div>
	)
}

export function CategoryFilterModal({
	isOpen,
	onClose,
	onApply,
	onClear,
	categories,
	initialInclude,
	initialExclude
}: CategoryFilterModalProps) {
	const [selectedInclude, setSelectedInclude] = React.useState<Array<string>>(initialInclude)
	const [selectedExclude, setSelectedExclude] = React.useState<Array<string>>(initialExclude)

	const categoryOptions = React.useMemo(
		() =>
			categories.map((category) => ({
				value: category,
				label: category
			})),
		[categories]
	)

	const selectedIncludeSet = React.useMemo(() => new Set(selectedInclude), [selectedInclude])
	const selectedExcludeSet = React.useMemo(() => new Set(selectedExclude), [selectedExclude])

	const { includeOptions, includeValue, excludeOptions, excludeValue } = React.useMemo(() => {
		return {
			includeOptions: categoryOptions.filter((opt) => !selectedExcludeSet.has(opt.value)),
			includeValue: categoryOptions.filter((opt) => selectedIncludeSet.has(opt.value)),
			excludeOptions: categoryOptions.filter((opt) => !selectedIncludeSet.has(opt.value)),
			excludeValue: categoryOptions.filter((opt) => selectedExcludeSet.has(opt.value))
		}
	}, [categoryOptions, selectedIncludeSet, selectedExcludeSet])

	const hasSelections = selectedInclude.length > 0 || selectedExclude.length > 0

	return (
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<Ariakit.Dialog
				className="dialog max-h-[80dvh] w-full max-w-lg gap-0 rounded-md border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-0 shadow-lg"
				unmountOnHide
				portal
				hideOnInteractOutside
			>
				<div
					className="flex items-center justify-between border-b pro-divider p-4"
					style={{ backgroundColor: 'var(--pro-panel-bg)' }}
				>
					<h2 className="text-lg font-semibold text-pro-text-primary">Filter Categories</h2>
					<Ariakit.DialogDismiss className="rounded-md pro-hover-bg p-2 transition-colors">
						<Icon name="x" height={20} width={20} />
						<span className="sr-only">Close dialog</span>
					</Ariakit.DialogDismiss>
				</div>

				<div className="flex-1 space-y-6 overflow-y-auto p-4" style={{ backgroundColor: 'var(--pro-panel-bg)' }}>
					<div>
						<label htmlFor="category-filter-include" className="mb-2 block text-sm font-medium text-pro-text-secondary">
							Include Categories
						</label>
						<ReactSelect<CategoryOption, true>
							inputId="category-filter-include"
							isMulti
							options={includeOptions}
							value={includeValue}
							onChange={(selection: MultiValue<CategoryOption>) => {
								setSelectedInclude(selection.map((item) => item.value))
							}}
							placeholder="Select categories to include..."
							styles={reactSelectStyles<CategoryOption, true, GroupBase<CategoryOption>>()}
							components={{ MenuList: SimpleMenuList }}
							closeMenuOnSelect={false}
							menuPosition="fixed"
						/>
					</div>

					<div>
						<label htmlFor="category-filter-exclude" className="mb-2 block text-sm font-medium text-pro-text-secondary">
							Exclude Categories
						</label>
						<ReactSelect<CategoryOption, true>
							inputId="category-filter-exclude"
							isMulti
							options={excludeOptions}
							value={excludeValue}
							onChange={(selection: MultiValue<CategoryOption>) => {
								setSelectedExclude(selection.map((item) => item.value))
							}}
							placeholder="Select categories to exclude..."
							styles={reactSelectStyles<CategoryOption, true, GroupBase<CategoryOption>>()}
							components={{ MenuList: SimpleMenuList }}
							closeMenuOnSelect={false}
							menuPosition="fixed"
						/>
					</div>
				</div>

				<div
					className="flex items-center justify-between border-t pro-divider p-4"
					style={{ backgroundColor: 'var(--pro-panel-bg)' }}
				>
					<button
						onClick={() => {
							setSelectedInclude([])
							setSelectedExclude([])
							onClear()
							onClose()
						}}
						className="pro-text-dimmed px-4 py-2 text-sm transition-colors hover:text-pro-text-primary disabled:opacity-50"
						disabled={!hasSelections}
					>
						Clear all
					</button>
					<div className="flex gap-2">
						<Ariakit.DialogDismiss className="rounded-md border pro-divider pro-hover-bg px-4 py-2 text-sm text-pro-text-primary transition-colors">
							Cancel
						</Ariakit.DialogDismiss>
						<button
							onClick={() => {
								onApply(selectedInclude, selectedExclude)
								onClose()
							}}
							className="rounded-md bg-brand px-4 py-2 text-sm text-on-brand transition-colors hover:bg-brand-muted"
						>
							Apply Filters
						</button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
