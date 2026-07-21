/** Export controls shared by chart renderers that provide their own toolbar. */
export type ChartExportButtonsMode =
	| 'auto'
	| 'hidden'
	| {
			png?: boolean
			csv?: boolean
			filename?: string
			pngTitle?: string
			pngIconUrl?: string
	  }
