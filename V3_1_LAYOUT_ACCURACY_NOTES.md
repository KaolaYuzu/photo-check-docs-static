# V3.1 Layout Engine Accuracy Upgrade — Notes

## Development Base
V3.0.2 (UX Softening Patch)

## New Architecture Layer: Layout Engine

```
V3.1 Pipeline:
  startOCR → classifyDocumentType (V2.7.1 4-class)
           → googleDocumentAIAdapter → normalizedDocumentJSON v3
           → layoutEngineAdapter → layoutStructure   ← NEW
           → runExtractionPipeline
               simple-table → runExcelMode (V3.1 smart grid)
               doc-like     → runDocModeV3 (layoutStructure paragraphs)
               structured-form/uncertain → Mode Gate
                   user selects Excel → structuredFormDraftBuilder → formDraftToTableSchema
                   user selects Doc   → runDocModeV3
```

## New Functions (V3.1)

| Function | Purpose |
|---|---|
| `layoutEngineAdapter(ocrResult, imageMeta, gridSignals, documentType)` | New layout engine interface → layoutStructure |
| `structuredFormDraftBuilder(normalizedDoc, layoutStructure)` | Builds {sections, fields, tables, notes} from form docs |
| `formDraftToTableSchema(draft, imageName)` | Converts formDraft → 2-col Label/Value XLSX schema |
| `buildDocumentTextFromLayout(layoutStructure, normalizedDoc)` | Para-grouped reading-order text |
| `calcExcelColWidth(col, cells, cmap, rows)` | Smart column width: CJK-aware + bbox-aware |
| `calcExcelRowHeight(row, cols, cmap, isHeader)` | Smart row height: text-wrap + line-count aware |

## layoutStructure Schema

```js
{
  pages:   [{ width, height, rotation }],
  blocks:  [{ id, type, bbox, readingOrder }],
  lines:   [{ id, text, bbox, blockId, readingOrder, words }],
  tables:  [{ id, bbox, rows: [{ cells: [{ text, bbox, rowSpan, colSpan, isHeader, isDark }] }] }],
  paragraphs: [{ id, text, bbox, blockId }],
  keyValueCandidates: [{ key, value, keyBbox, valueBbox, confidence }],
  detectedColumns: [{ x, width, colIdx }],
  detectedRows:    [{ y, height, rowIdx, isHeader }],
  readingOrder: [lineId, ...],
  meta: { provider, processingTime, documentType, _noRetain: true }
}
```

## Extraction Strategy by Document Type

### simple-table
- `layoutEngineAdapter` builds `detectedColumns`, `detectedRows`, table cells
- Column width: `calcExcelColWidth` (text-length + bbox, CJK-aware, min 9, max 55)
- Row height: `calcExcelRowHeight` (text-wrap line count, CJK-aware, max 80pt)
- XLSX: `bestFit="1"` on all columns

### structured-form (user selects Excel from Mode Gate)
- `structuredFormDraftBuilder` extracts kv-pairs, embedded tables, notes
- `formDraftToTableSchema` builds a 2-column "Field | Value" layout
- Readable, not a grid overlay — works even when form has irregular structure
- Notes section appended at bottom

### doc-like
- `runDocModeV3` now calls `buildDocumentTextFromLayout` first
- `buildDocumentTextFromLayout` groups consecutive lines into paragraphs (gap > 28px)
- Falls back to `buildTxtFromNormalizedDoc` if no layout paragraphs

## XLSX Improvements (V3.1 vs V3.0.2)

| Feature | Before (V3.0.2) | After (V3.1) |
|---|---|---|
| Column width | Fixed px÷7.2 | Text-length + bbox, CJK-aware, min 9 |
| Row height | Fixed formula | Text-wrap line count, CJK-aware |
| Text wrap | wrapText on all | wrapText with accurate line count |
| bestFit | Not set | Set on all columns |
| Structured form | Same as simple-table | 2-col Label/Value draft |
| Document | Forced to Excel | Doc Mode only (no Excel override) |

## Structured Form Excel Draft Format
```
欄位 / Field  |  內容 / Value
──────────────|──────────────
Label 1       |  Value 1
Label 2       |  Value 2
...           |  ...
── 備註 / Notes ──
              |  Note text
```

## Provider Adapter Roadmap

| Provider | Status | Notes |
|---|---|---|
| Google Document AI Layout Parser | Planned | Replace `googleDocumentAIAdapter` + `layoutEngineAdapter` body |
| Azure AI Document Intelligence Layout | Planned | Same interface |
| AWS Textract AnalyzeDocument | Planned | Same interface |
| PaddleOCR PP-Structure | Planned | Local / on-premise |
| Local TSR | Planned | Table Structure Recognition |

LLM Vision Policy: only as optional fallback for individual uncertain blocks, NOT as primary parser for full documents.

## Test Expectations

| Document | V3.0.2 | V3.1 |
|---|---|---|
| Menu / price list | Excel, readable | Excel, smarter column widths |
| Maintenance form | Mode Gate | Mode Gate → Excel gives Label/Value 2-col |
| Shareholder notice | Doc Mode | Doc Mode, better paragraph grouping |
| State reset | Clears all | Also clears layoutStructure |

## Unchanged (V3.0.2 preserved)
- Safety notice (calm/reassuring style)
- Mode Gate product copy
- Draft notice banner
- Confidence/risk hidden from users
- Landing page section order: Hero → Roadmap → Security → Features → …
- Credits logic
- api/ocr.js, vercel.json
