import type { CSSObjectWithLabel, GroupBase, StylesConfig } from 'react-select'

export const reactSelectStyles = <Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
	controlOverrides: CSSObjectWithLabel = {}
): StylesConfig<Option, IsMulti, Group> => ({
	control: (provided, state) => ({
		...provided,
		backgroundColor: 'var(--bg-surface-elevated-1)',
		border: '1px solid var(--pro-form-control-border)',
		borderRadius: 6,
		minHeight: '40px',
		boxShadow: 'none',
		...controlOverrides,
		'&:hover': {
			border: '1px solid var(--pro-form-control-border)'
		},
		...(state.isFocused && {
			border: '1px solid var(--bg-brand)',
			'&:hover': {
				border: '1px solid var(--bg-brand)'
			}
		})
	}),
	menu: (provided) => ({
		...provided,
		backgroundColor: 'var(--pro-cards-bg)',
		border: '1px solid var(--pro-cards-border)',
		borderRadius: 6,
		boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
	}),
	menuList: (provided) => ({
		...provided,
		padding: 0,
		backgroundColor: 'var(--pro-panel-bg)'
	}),
	option: (provided, state) => ({
		...provided,
		backgroundColor: state.isSelected
			? 'var(--bg-brand)'
			: state.isFocused
				? 'var(--bg-surface-elevated-2)'
				: 'transparent',
		color: state.isSelected ? 'white' : 'var(--pro-text-primary)',
		padding: '8px 12px',
		'&:hover': {
			backgroundColor: state.isSelected ? 'var(--bg-brand)' : 'var(--bg-surface-elevated-2)'
		}
	}),
	singleValue: (provided) => ({
		...provided,
		color: 'var(--pro-text-primary)'
	}),
	placeholder: (provided) => ({
		...provided,
		color: 'var(--pro-text-tertiary)'
	}),
	input: (provided) => ({
		...provided,
		color: 'var(--pro-text-primary)'
	}),
	indicatorSeparator: () => ({
		display: 'none'
	}),
	dropdownIndicator: (provided) => ({
		...provided,
		color: 'var(--pro-text-tertiary)',
		'&:hover': {
			color: 'var(--pro-text-primary)'
		}
	})
})
