interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
	id?: string | undefined
	header?: React.ReactNode | undefined
	chartClassName?: string | undefined
	chartStyle?: React.CSSProperties | undefined
	chartRef?: React.Ref<HTMLDivElement> | undefined
	overlay?: React.ReactNode | undefined
}

export function ChartContainer({
	id,
	header,
	chartClassName,
	chartStyle,
	chartRef,
	className,
	overlay,
	...props
}: ChartContainerProps) {
	return (
		<div className={`relative ${className ?? ''}`} {...props}>
			{header}
			<div ref={chartRef} id={id} className={chartClassName} style={chartStyle} />
			{overlay}
		</div>
	)
}
