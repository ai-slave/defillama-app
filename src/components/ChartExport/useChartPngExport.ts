import type * as echarts from 'echarts/core'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { downloadDataURL } from '~/utils/download'
import { IMAGE_EXPORT_HEIGHT, renderClonedChartExport, type PngExportProfile } from './chartPngExport'
import { IMAGE_EXPORT_WIDTH } from './chartPngExportLayout'
export interface ChartPngExportOptions {
	chartInstance: () => echarts.ECharts | null
	title?: string | undefined
	filename?: string | undefined
	iconUrl?: string | undefined
	expandLegend?: boolean | undefined
	pngProfile?: PngExportProfile | undefined
	onExport?: ((info: { kind: 'download' | 'copy'; filename: string }) => void) | undefined
}
export function useChartPngExport({
	chartInstance,
	title,
	filename,
	iconUrl,
	expandLegend,
	pngProfile = 'default',
	onExport
}: ChartPngExportOptions) {
	const [isLoading, setIsLoading] = useState(false)

	const [isDark] = useDarkModeManager()

	const generateDataURL = async (): Promise<string | null> => {
		const _chartInstance = chartInstance()

		if (!_chartInstance) {
			toast.error("Couldn't find the chart.")
			return null
		}
		setIsLoading(true)

		const tempContainer = document.createElement('div')
		tempContainer.style.cssText = `width:${IMAGE_EXPORT_WIDTH}px;height:${IMAGE_EXPORT_HEIGHT}px;position:absolute;left:-99999px;top:0;`
		document.body.appendChild(tempContainer)

		try {
			const dataURL = await renderClonedChartExport(
				tempContainer,
				_chartInstance,
				isDark,
				title,
				iconUrl,
				expandLegend,
				pngProfile
			)
			document.body.removeChild(tempContainer)
			return dataURL
		} catch (error) {
			console.log('Error exporting chart image:', error)
			toast.error("Couldn't export the chart image.")
			document.body.removeChild(tempContainer)
			return null
		}
	}

	const downloadImage = () => {
		if (isLoading) return
		generateDataURL()
			.then((dataURL) => {
				if (!dataURL) return
				let safeFilename = filename || 'chart'
				if (safeFilename.toLowerCase().endsWith('.png')) {
					safeFilename = safeFilename.slice(0, -4)
				}
				const imageFilename = `${safeFilename}_${new Date().toISOString().split('T')[0]}.png`
				downloadDataURL(imageFilename, dataURL)
				onExport?.({ kind: 'download', filename: imageFilename })
			})
			.catch((error) => {
				console.log('Error exporting chart image:', error)
				toast.error("Couldn't export the chart image.")
			})
			.finally(() => setIsLoading(false))
	}

	const copyImage = () => {
		if (isLoading) return
		const blobPromise = (async () => {
			const dataURL = await generateDataURL()
			if (!dataURL) throw new Error("Couldn't create the image.")
			const response = await fetch(dataURL)
			return await response.blob()
		})()

		navigator.clipboard
			.write([new ClipboardItem({ 'image/png': blobPromise })])
			.then(() => {
				toast.success('Image copied to clipboard')
				onExport?.({ kind: 'copy', filename: filename || 'chart' })
			})
			.catch((error) => {
				console.log('Error copying chart image:', error)
				toast.error("Couldn't copy the image.")
			})
			.finally(() => setIsLoading(false))
	}

	return { isExporting: isLoading, downloadImage, copyImage }
}
