# Sizing table columns

How to pick the `w-[Npx]` / `min-w-[Npx]` values in a column's `meta.headerClassName`
so columns are as tight as possible without clipping. This is the method used to
re-tighten the Equities table; the estimates land within ~1px of what the browser
actually renders.

## Why the math is exact

`PaginatedTable` renders with `table-layout: fixed` and a `<colgroup>` where every
`<col>` gets the column's `headerClassName` width (see `PaginatedTable.tsx`,
`style={{ tableLayout: 'fixed' }}` + the `<colgroup>`). With fixed layout:

- The rendered column width **equals** the `w-[Npx]` you set — content never widens it,
  it only gets clipped/wrapped if too narrow. So there is no "browser splits the
  remaining space" guesswork; you are setting the real pixel width directly.
- Tailwind sets `box-sizing: border-box`, so the width **includes** the cell padding.

That means a column's minimum safe width is a pure sum you can compute up front.

The main `VirtualTable` (`Table.tsx`) shares all of this — same `table-layout: fixed` +
`<colgroup>` with the column's `headerClassName`, same `p-3` (24px) padding, same 10px
`SortIcon` — so everything here applies to those tables too. The one difference:
`VirtualTable` already truncates every cell, so wrapping isn't a concern there.

## The formula

```
width = ceil( PADDING + max(headerContent, bodyContent) ) + BUFFER
```

| term            | value | where it comes from                                                      |
| --------------- | ----- | ------------------------------------------------------------------------ |
| `PADDING`       | 24px  | `px-3` on both `<th>` and `<td>` = 12px × 2 (`helpers.tsx`)              |
| `headerContent` | —     | text width of the header label + (sort affordance, if sortable)          |
| sort affordance | 14px  | 10px `SortIcon` + 4px `gap-1` — **only** when `enableSorting !== false`  |
| `bodyContent`   | —     | text width of the **widest realistic** rendered cell value               |
| `BUFFER`        | 0px   | not needed for the gap — `px-3` already gives 12px each side (see below) |

Notes:

- **Header vs body** — take the wider of the two. Long-label numeric columns
  (`1D Market Cap Change`, `Holder Earnings (TTM)`) are header-bound; short-label ones
  (`P/E`, `P/S`, `Price`) are body-bound — there the formatted number is wider than the
  label, so don't shrink them to the header.
- **Sortable only** — ticker/country in Equities set `enableSorting: false`, so they
  carry no sort icon. Every other column does, hence the +14px.
- **Non-text body** — cells with a logo/flag/link (ticker, country, company) are sized
  by that content, not the header; measure the real cell, don't trim them blindly.
- Fonts: the table is `text-sm` (14px) and the app font is **proportional Inter** (`--font-inter`,
  `public/fonts/inter.woff2`). Header is `font-medium`; for Inter the advance widths are
  effectively constant across weight, so 400 vs 500 doesn't change the result. Ordinary
  numeric cells do not use `mono-*` or `tabular-nums`; those are reserved for the explicit
  metric/code and changing-value cases documented in `design.md`.
- **Buffer is optional, default 0.** The 24px of `px-3` padding already keeps text well
  clear of the column edge — adding more just makes columns loose. A column whose content
  - padding ≈ its width is already correct; don't pad it out. The only case for a few px:
    a **body-bound numeric** column, as a hedge against a larger value sitting in rows you
    didn't have on screen (only visible rows get measured). Header-bound columns never need
    it — the header is fixed and can't grow.

## Measuring text width

Two ways. The browser console is the most accurate (it uses the exact rendered font)
and needs no dependencies — prefer it.

### A. In the browser (recommended)

Open any page that already renders the table, paste into the console. This measures the
**actual** header labels and body cells in the DOM, so it accounts for the real font,
the sort icon, and padding automatically:

```js
// Reports, per visible column, the px you could shave (positive) or must add (negative).
// Run on the live table. Leave BUFFER at 0 for a correct/tight fit (px-3 already pads).
const BUFFER = 0
const table = document.querySelector('table')
const headers = [...table.tHead.rows[0].cells]
const bodyRows = [...table.tBodies[0].rows]
// True content width of a cell (padding-free, handles text, icons, mixed children alike).
const contentWidth = (cell) => {
	const range = document.createRange()
	range.selectNodeContents(cell)
	return range.getBoundingClientRect().width
}
headers.forEach((th, i) => {
	// widest content across header + every body cell in this column
	const cells = [th, ...bodyRows.map((r) => r.cells[i])].filter(Boolean)
	const need = Math.max(...cells.map((c) => Math.ceil(contentWidth(c))))
	const pad = parseFloat(getComputedStyle(th).paddingLeft) + parseFloat(getComputedStyle(th).paddingRight)
	const suggest = need + pad + BUFFER
	const current = th.getBoundingClientRect().width
	console.log(
		th.innerText.trim().padEnd(24),
		'now',
		Math.round(current),
		'→',
		suggest,
		`(${Math.round(current - suggest)})`
	)
})
```

`Range.getBoundingClientRect()` measures the rendered content box of the cell regardless
of what's inside — plain numbers, an icon + link, a row of chain logos — so it's the one
measurement that works for **every** column type, unlike the label-only offline method.

Caveat: only the **current page of rows** is measured, so make sure large values are on
screen (sort descending, or bump rows-per-page) before trusting the body width. For a
descending numeric directory such as `/tokens`, the first row is the practical maximum
for that sorted metric and should be the sizing reference instead of adding a speculative
oversized buffer.

### B. Offline from the font file (no browser)

Useful for computing widths from labels alone before the data exists. Uses `fontkit`
against the shipped woff2. Install it as a throwaway dev tool (don't add to deps):

```js
import * as fontkit from 'fontkit'
const font = fontkit.openSync('public/fonts/inter.woff2')
const textWidth = (str, px = 14) => {
	const { glyphs } = font.layout(str)
	const advance = glyphs.reduce((a, g) => a + g.advanceWidth, 0)
	return (advance / font.unitsPerEm) * px
}

const PAD = 24,
	SORT = 14,
	BUFFER = 0
// widest realistic body string per format: '$' → '$999.99B', '%' → '-99.99%', plain → '999.99B'
function width({ label, body, sortable = true }) {
	const header = textWidth(label) + (sortable ? SORT : 0)
	const need = Math.max(header, body ? textWidth(body) : 0)
	return Math.ceil(PAD + need) + BUFFER
}
// width({ label: 'Market Cap', body: '$999.99B' }) → 121
```

The canonical compact formatters cap K/M values at two decimal places and B/T values at three,
so representative worst-case strings stay short: `$999.99M`, `-$999.999B`, `-99.99%`, `999.999B`.

## Text columns: widen vs. ellipsis

Numeric columns have one worst-case width. **Text** columns (sector, industry, company,
descriptions…) vary cell to cell, so a single "widest value" is the wrong target — one
freak-long row would make every column absurdly wide. Instead decide per column:

- **Bounded vocabulary** (e.g. Sector — ~11 possible values) → **widen** so the vast
  majority render on one line. A rare long value can ellipsis.
- **High-variance / long free text** (e.g. Industry, category descriptions) → pick a
  sensible fixed width and **ellipsis** the overflow. Don't chase the longest value.

In **both** cases the body cell should be set to **not wrap** — wrapping is what makes
rows uneven and tall (the actual visual bug). `PaginatedTable` body cells wrap by
default; opt a column into single-line + ellipsis with `meta.cellClassName: 'truncate'`
(`truncate` = `overflow-hidden whitespace-nowrap text-ellipsis`). The main `Table.tsx`
already truncates every cell, so this only matters for `PaginatedTable`-based tables.

### Truncated values have no tooltip

A clipped cell shows an ellipsis but does **not** reveal the full value on hover — there is
no native `title` and no React tooltip. (An earlier delegated `mouseover` title-setter was
removed: it ran on every hover across every `PaginatedTable` in the app, forced a layout
reflow per hover, and produced garbled titles for cells with mixed content.) If a column
needs its full value readable, give it a wider width or a dedicated cell-level tooltip
rather than relying on truncation alone.

### Counting how many cells wrap

Run on the live table — measures each body cell's natural single-line width (via canvas
in the cell's real font) and reports, per column, what % overflow the current width plus
the width needed to fit 90% / all of the visible rows:

```js
const BUFFER = 0
const table = document.querySelector('table')
const heads = [...table.tHead.rows[0].cells]
const rows = [...table.tBodies[0].rows]
const ctx = document.createElement('canvas').getContext('2d')
heads.forEach((th, i) => {
	const cells = rows.map((r) => r.cells[i]).filter(Boolean)
	if (!cells.length) return
	const cs = getComputedStyle(cells[0])
	ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
	const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
	const colW = th.getBoundingClientRect().width
	const needs = cells.map((c) => Math.ceil(ctx.measureText(c.innerText.trim()).width) + pad).sort((a, b) => a - b)
	const overflow = needs.filter((n) => n > colW + 0.5).length
	const p90 = needs[Math.floor(needs.length * 0.9)]
	console.log(
		th.innerText.trim().padEnd(20),
		`w=${Math.round(colW)}`,
		`overflow ${overflow}/${needs.length} (${Math.round((overflow / needs.length) * 100)}%)`,
		`fit-90%→${p90 + BUFFER}  fit-all→${needs[needs.length - 1] + BUFFER}`
	)
})
```

Read it like this: if `fit-all` is modest and overflow is low → bounded, set `fit-all`
(or `fit-90%`). If overflow is high and `fit-all` is huge → free text, keep a modest
width near `fit-90%` and add `truncate`. (Only the visible page of rows is measured, so
load enough rows first.)

## Applying

Set both halves so the column can't be squeezed below its target:

```ts
// numeric column — tight fit, no wrapping concern
meta: { headerClassName: 'w-[121px] min-w-[121px]', align: 'end' }

// text column — single line, ellipsis the overflow
meta: { headerClassName: 'w-[170px] min-w-[170px]', cellClassName: 'truncate', align: 'start' }
```

Keep responsive variants where they exist, e.g. Equities' country column:
`'w-[76px] min-w-[76px] lg:w-[88px] lg:min-w-[88px]'`.
