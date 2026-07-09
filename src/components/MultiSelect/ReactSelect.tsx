import Select, { type Props } from 'react-select'

const customStyles: NonNullable<Props['styles']> = {
	control: (provided) => ({
		...provided,
		background: 'var(--ld-bg-surface)',
		padding: '2px',
		borderRadius: '6px',
		border: '1px solid var(--ld-border-medium)',
		color: 'var(--ld-text-primary)',
		boxShadow: 'none',
		margin: 0,
		zIndex: 0
	}),
	input: (provided) => ({
		...provided,
		color: 'var(--ld-text-primary)'
	}),
	menu: (provided) => ({
		...provided,
		background: 'var(--ld-bg-surface-elevated-1)',
		zIndex: 10
	}),
	option: (provided) => ({
		...provided,
		color: 'var(--ld-text-primary)'
	}),
	multiValue: (provided) => ({
		...provided,
		fontFamily: 'inherit',
		background: 'var(--ld-bg-surface-elevated-2)',
		padding: '2px'
	}),
	multiValueLabel: (styles) => ({
		...styles,
		color: 'var(--ld-text-primary)'
	}),
	placeholder: (provided) => ({
		...provided,
		color: 'var(--ld-text-tertiary)'
	}),
	singleValue: (provided, _state) => ({
		...provided,
		color: 'var(--ld-text-primary)'
	})
}

export const ReactSelect = ({ options, styles, ...props }: Props) => (
	<Select
		styles={{ ...customStyles, ...styles }}
		options={options}
		theme={(theme) => {
			return {
				...theme,
				colors: {
					...theme.colors,
					primary25: 'var(--bg2)',
					primary50: 'var(--bg2)',
					primary75: 'var(--bg2)'
				}
			}
		}}
		{...props}
	/>
)
