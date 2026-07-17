import { tw } from './tw'
/** Shared DOM-chart chrome. Chart data, geometry, and canvas options stay local. */
export const domChartCrosshairStyles = tw`pointer-events-none absolute top-0 h-full border-l border-dashed border-medium`

export const domChartTooltipStyles = tw`pointer-events-none fixed z-10 rounded-md border border-medium bg-overlay px-2.5 py-1.5 body-sm whitespace-nowrap text-secondary shadow-md`
