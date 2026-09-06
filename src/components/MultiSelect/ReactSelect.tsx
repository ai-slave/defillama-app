import Select, { type CSSObjectWithLabel, type GroupBase, type Props, type StylesConfig } from 'react-select'

const controlStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	background: 'var(--bg-surface)',
	padding: '2px',
	borderRadius: '6px',
	border: '1px solid var(--border-medium)',
	color: 'var(--text-primary)',
	boxShadow: 'none',
	margin: 0,
	zIndex: 0
})
const inputStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	color: 'var(--text-primary)'
})
const menuStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	background: 'var(--bg-surface-elevated-1)',
	zIndex: 10
})
const optionStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	color: 'var(--text-primary)'
})
const multiValueStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	fontFamily: 'inherit',
	background: 'var(--bg-surface-elevated-2)',
	padding: '2px'
})
const primaryTextStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	color: 'var(--text-primary)'
})
const placeholderStyle = (provided: CSSObjectWithLabel): CSSObjectWithLabel => ({
	...provided,
	color: 'var(--text-tertiary)'
})

function getCustomStyles<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(): StylesConfig<
	Option,
	IsMulti,
	Group
> {
	return {
		control: controlStyle,
		input: inputStyle,
		menu: menuStyle,
		option: optionStyle,
		multiValue: multiValueStyle,
		multiValueLabel: primaryTextStyle,
		placeholder: placeholderStyle,
		singleValue: primaryTextStyle
	}
}

export function ReactSelect<
	Option,
	IsMulti extends boolean = false,
	Group extends GroupBase<Option> = GroupBase<Option>
>({ options, styles, ...props }: Props<Option, IsMulti, Group>) {
	return (
		<Select
			styles={
				styles ? { ...getCustomStyles<Option, IsMulti, Group>(), ...styles } : getCustomStyles<Option, IsMulti, Group>()
			}
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
}
