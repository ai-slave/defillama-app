export const reactSelectStyles = {
	control: (provided: any, state: any) => ({
		...provided,
		backgroundColor: 'var(--bg-surface-elevated-1)',
		border: '1px solid var(--pro-form-control-border)',
		borderRadius: 6,
		minHeight: '40px',
		boxShadow: 'none',
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
	menu: (provided: any) => ({
		...provided,
		backgroundColor: 'var(--pro-cards-bg)',
		border: '1px solid var(--pro-cards-border)',
		borderRadius: 6,
		boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
	}),
	menuList: (provided: any) => ({
		...provided,
		padding: 0,
		backgroundColor: 'var(--pro-bg1)'
	}),
	option: (provided: any, state: any) => ({
		...provided,
		backgroundColor: state.isSelected
			? 'var(--bg-brand)'
			: state.isFocused
				? 'var(--bg-surface-elevated-2)'
				: 'transparent',
		color: state.isSelected ? 'white' : 'var(--pro-text1)',
		padding: '8px 12px',
		'&:hover': {
			backgroundColor: state.isSelected ? 'var(--bg-brand)' : 'var(--bg-surface-elevated-2)'
		}
	}),
	singleValue: (provided: any) => ({
		...provided,
		color: 'var(--pro-text1)'
	}),
	placeholder: (provided: any) => ({
		...provided,
		color: 'var(--pro-text3)'
	}),
	input: (provided: any) => ({
		...provided,
		color: 'var(--pro-text1)'
	}),
	indicatorSeparator: () => ({
		display: 'none'
	}),
	dropdownIndicator: (provided: any) => ({
		...provided,
		color: 'var(--pro-text3)',
		'&:hover': {
			color: 'var(--pro-text1)'
		}
	})
}
