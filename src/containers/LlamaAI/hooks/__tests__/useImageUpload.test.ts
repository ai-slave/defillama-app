import { describe, expect, it } from 'vitest'
import { maxSizeForFile } from '../useImageUpload'

const MB = 1024 * 1024

describe('maxSizeForFile', () => {
	it('allows data files up to 100MB so large CSV exports can be attached in chat', () => {
		expect(maxSizeForFile(new File([''], 'launches.csv', { type: 'text/csv' }))).toBe(100 * MB)
		expect(maxSizeForFile(new File([''], 'notes.md', { type: 'text/markdown' }))).toBe(100 * MB)
		expect(maxSizeForFile(new File([''], 'dump.txt', { type: 'text/plain' }))).toBe(100 * MB)
	})

	it('keeps documents at 30MB because they are sent to the model as PDFs', () => {
		expect(maxSizeForFile(new File([''], 'report.pdf', { type: 'application/pdf' }))).toBe(30 * MB)
		expect(
			maxSizeForFile(
				new File([''], 'book.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
			)
		).toBe(30 * MB)
	})

	it('keeps images at 10MB', () => {
		expect(maxSizeForFile(new File([''], 'chart.png', { type: 'image/png' }))).toBe(10 * MB)
	})

	it('classifies a CSV by extension when the browser reports an Excel mime', () => {
		expect(maxSizeForFile(new File([''], 'launches.csv', { type: 'application/vnd.ms-excel' }))).toBe(100 * MB)
	})
})
