import { tw } from './tw'
/* ----------------------------------------------------------------------------
   MetricChip — selected-chart-metric chip (Figma node 6183:312062).

   rounded-full, 32px tall (md row height), label-sm in text-primary (white —
   NOT link-blue), 2px gap to a 16px trailing × icon, px-2. The border color
   is the metric's series color, supplied inline:

     <span className={metricChipStyles} style={{ borderColor: seriesColor }}>
       <span>TVL</span>
       <Icon name="x" className="size-4" />
     </span>

   Exported as a class string because chips wrap peer checkbox inputs inside
   <label>s at the call sites.
---------------------------------------------------------------------------- */

export const metricChipStyles = tw`flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-full border px-2 py-1.5 label-sm whitespace-nowrap text-primary hover:bg-hover-row focus-visible:bg-hover-row`

export const metricOptionChipStyles = tw`hover-wash group flex min-h-6 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-medium px-2 py-0.5 label-sm whitespace-nowrap text-primary transition-[background-color,border-color,color] duration-150 ease-out hover:border-brand focus-visible:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link`
