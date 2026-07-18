interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
	id?: string
	header?: React.ReactNode
	chartClassName?: string
	chartStyle?: React.CSSProperties
	chartRef?: React.Ref<HTMLDivElement>
	overlay?: React.ReactNode
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
			<div ref={chartRef} id={id} className={chartClassName ?? 'my-auto min-h-[360px]'} style={chartStyle} />
			{overlay}
		</div>
	)
}
