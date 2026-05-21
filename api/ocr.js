import crypto from 'node:crypto';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKey, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${signature}`;
}

async function getAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = signJwt({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }, privateKey);

  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', jwt);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) throw new Error('Google auth failed');
  const json = await res.json();
  return json.access_token;
}

function getAnchoredText(documentText, layout) {
  const segments = layout?.textAnchor?.textSegments || [];
  return segments.map((seg) => {
    const start = Number(seg.startIndex || 0);
    const end = Number(seg.endIndex || 0);
    return documentText.slice(start, end);
  }).join('').replace(/\s+/g, ' ').trim();
}

function makeUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((h, i) => {
    const base = h && h.trim() ? h.trim() : `欄位${i + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

function parseTables(document) {
  const text = document?.text || '';
  const pages = document?.pages || [];
  const rows = [];

  for (const page of pages) {
    for (const table of page.tables || []) {
      const headerRows = table.headerRows || [];
      const bodyRows = table.bodyRows || [];
      const sourceRows = [...headerRows, ...bodyRows];
      if (!sourceRows.length) continue;

      let headers = [];
      let dataRows = bodyRows;

      if (headerRows.length) {
        const lastHeader = headerRows[headerRows.length - 1];
        headers = (lastHeader.cells || []).map((cell) => getAnchoredText(text, cell.layout));
      } else {
        const first = sourceRows[0];
        const firstValues = (first.cells || []).map((cell) => getAnchoredText(text, cell.layout));
        const looksLikeHeader = firstValues.some((v) => /品名|項目|名稱|數量|日期|金額|單價|結果|備註|內容/.test(v));
        if (looksLikeHeader && sourceRows.length > 1) {
          headers = firstValues;
          dataRows = sourceRows.slice(1);
        } else {
          headers = firstValues.map((_, i) => `欄位${i + 1}`);
          dataRows = sourceRows;
        }
      }

      headers = makeUniqueHeaders(headers);

      for (const tr of dataRows) {
        const cells = tr.cells || [];
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = getAnchoredText(text, cells[i]?.layout) || '';
        });
        if (Object.values(obj).some(Boolean)) rows.push(obj);
      }
    }
  }

  return rows;
}

function getBoxCenter(layout) {
  const vertices = layout?.boundingPoly?.normalizedVertices || layout?.boundingPoly?.vertices || [];
  if (!vertices.length) return null;
  const xs = vertices.map((v) => Number(v.x || 0));
  const ys = vertices.map((v) => Number(v.y || 0));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, minX, maxX, minY, maxY };
}

function collectLayoutItems(document) {
  const text = document?.text || '';
  const pages = document?.pages || [];
  const items = [];

  for (const page of pages) {
    const candidates = page.lines || page.paragraphs || page.blocks || [];
    for (const node of candidates) {
      const value = getAnchoredText(text, node.layout);
      const box = getBoxCenter(node.layout);
      if (value && box) items.push({ text: value, ...box });
    }

    if (!candidates.length) {
      for (const block of page.blocks || []) {
        const value = getAnchoredText(text, block.layout);
        const box = getBoxCenter(block.layout);
        if (value && box) items.push({ text: value, ...box });
      }
    }
  }

  return items;
}

function clusterValues(values, tolerance) {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const clusters = [];
  for (const v of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(last.center - v) > tolerance) clusters.push({ center: v, values: [v] });
    else { last.values.push(v); last.center = last.values.reduce((a, b) => a + b, 0) / last.values.length; }
  }
  return clusters.map((c) => c.center);
}

function parseGridReconstruction(document) {
  const items = collectLayoutItems(document);
  if (items.length < 10) return [];

  const pageMinX = Math.min(...items.map(i => i.minX));
  const pageMaxX = Math.max(...items.map(i => i.maxX));
  const pageMinY = Math.min(...items.map(i => i.minY));
  const pageMaxY = Math.max(...items.map(i => i.maxY));
  if (pageMaxX - pageMinX < 0.35 || pageMaxY - pageMinY < 0.25) return [];

  const xCenters = clusterValues(items.map(i => i.minX), 0.045);
  let columns = xCenters.filter((x) => x >= pageMinX - 0.01 && x <= pageMaxX + 0.01);
  if (columns.length < 3) return [];
  if (columns.length > 10) columns = clusterValues(columns, 0.075);
  if (columns.length < 3) return [];

  const rowCenters = clusterValues(items.map(i => i.y), 0.018);
  if (rowCenters.length < 5) return [];

  const rows = rowCenters.map((y, rowIndex) => {
    const rowItems = items.filter((i) => Math.abs(i.y - y) <= 0.022).sort((a, b) => a.x - b.x);
    const obj = { 行號: String(rowIndex + 1) };
    for (let c = 0; c < columns.length; c++) obj[`欄${c + 1}`] = '';
    for (const item of rowItems) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < columns.length; c++) {
        const d = Math.abs(item.minX - columns[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      const key = `欄${best + 1}`;
      obj[key] = obj[key] ? `${obj[key]} ${item.text}` : item.text;
    }
    return obj;
  }).filter((r) => Object.keys(r).some(k => k !== '行號' && r[k]));

  const filledCells = rows.reduce((sum, r) => sum + Object.keys(r).filter(k => k !== '行號' && r[k]).length, 0);
  const density = filledCells / Math.max(1, rows.length * columns.length);
  if (rows.length < 5 || columns.length < 3 || density < 0.12) return [];

  const first = rows[0];
  const values = Object.keys(first).filter(k => k !== '行號').map(k => first[k]);
  const headerLike = values.some(v => /品項|品名|單價|數量|金額|內容|項目|結果|備註|日期/.test(v));
  if (headerLike && rows.length > 1) {
    const headers = makeUniqueHeaders(values.map((v, i) => v || `欄${i + 1}`));
    return rows.slice(1).map((r, idx) => {
      const out = { 行號: String(idx + 1) };
      headers.forEach((h, i) => { out[h] = r[`欄${i + 1}`] || ''; });
      return out;
    });
  }

  return rows;
}

function parseTwoColumnLayout(document) {
  const items = collectLayoutItems(document);
  if (items.length < 6) return [];

  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const minX = xs[0], maxX = xs[xs.length - 1];
  if (maxX - minX < 0.28) return [];

  const splitX = xs[Math.floor(xs.length / 2)];
  const yTolerance = 0.018;

  const sorted = items.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const groups = [];

  for (const item of sorted) {
    let group = groups.find((g) => Math.abs(g.y - item.y) <= yTolerance);
    if (!group) {
      group = { y: item.y, left: [], right: [] };
      groups.push(group);
    }
    if (item.x <= splitX) group.left.push(item);
    else group.right.push(item);
    group.y = (group.y + item.y) / 2;
  }

  const rows = groups
    .sort((a, b) => a.y - b.y)
    .map((g, index) => ({
      行號: String(index + 1),
      左欄: g.left.sort((a, b) => a.x - b.x).map((i) => i.text).join(' '),
      右欄: g.right.sort((a, b) => a.x - b.x).map((i) => i.text).join(' '),
    }))
    .filter((r) => r.左欄 || r.右欄);

  const nonEmptyRight = rows.filter((r) => r.右欄).length;
  if (nonEmptyRight < Math.max(3, rows.length * 0.2)) return [];
  return rows;
}

function buildVisual(document) {
  const items = collectLayoutItems(document).map((item) => ({
    text: item.text,
    minX: Number(item.minX || 0),
    minY: Number(item.minY || 0),
    maxX: Number(item.maxX || 0),
    maxY: Number(item.maxY || 0),
    x: Number(item.x || 0),
    y: Number(item.y || 0),
  })).filter((i) => i.text);
  if (!items.length) return null;

  // Extract image aspect ratio from Document AI page dimensions
  // Document AI returns dimension in the page object (unit: points or pixels)
  const pages = document?.pages || [];
  let aspectRatio = null;
  if (pages.length > 0) {
    const dim = pages[0].dimension;
    if (dim && dim.width && dim.height) {
      aspectRatio = Number(dim.height) / Number(dim.width);
    }
  }

  const minX = Math.max(0, Math.min(...items.map(i => i.minX)) - 0.02);
  const maxX = Math.min(1, Math.max(...items.map(i => i.maxX)) + 0.02);
  const minY = Math.max(0, Math.min(...items.map(i => i.minY)) - 0.02);
  const maxY = Math.min(1, Math.max(...items.map(i => i.maxY)) + 0.02);

  let columns = clusterValues(items.map(i => i.minX), 0.045).filter(x => x >= minX && x <= maxX);
  if (columns.length > 14) columns = clusterValues(columns, 0.065);
  let rows = clusterValues(items.map(i => i.y), 0.018).filter(y => y >= minY && y <= maxY);
  if (rows.length > 80) rows = clusterValues(rows, 0.026);

  function boundaries(centers, start, end) {
    if (!centers.length) return [start, end];
    const sorted = [...centers].sort((a, b) => a - b);
    const out = [start];
    for (let i = 0; i < sorted.length - 1; i++) out.push((sorted[i] + sorted[i + 1]) / 2);
    out.push(end);
    return out.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 0.003);
  }

  return {
    version: 'visual-reconstruction-v1.4',
    bounds: { minX, maxX, minY, maxY },
    columns: boundaries(columns, minX, maxX),
    rows: boundaries(rows, minY, maxY),
    items,
    // V1.4: include aspect ratio from Document AI page dimensions
    aspectRatio: aspectRatio || ((maxY - minY) / Math.max(0.01, maxX - minX)),
  };
}

function parseFallbackText(document) {
  const gridRows = parseGridReconstruction(document);
  if (gridRows.length) return gridRows;

  const layoutRows = parseTwoColumnLayout(document);
  if (layoutRows.length) return layoutRows;

  const text = document?.text || '';
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [{ 段落: '' }];
  return lines.map((line, index) => ({ 行號: String(index + 1), 段落: line }));
}

// ─────────────────────────────────────────────────────────────────────────────
// V1.4 Phase 1 — Layout Data Extraction
//
// Goal: build a `layoutData` payload from Document AI's raw response so that
// Phase 2 (SVG Visual Reconstruction) can use precise page coordinates instead
// of the normalised 0-1 estimates that `buildVisual` currently returns.
//
// Nothing below touches the existing rows / visual / table parsers.
// The frontend currently reads only `json.rows` and `json.visual`, so adding
// `json.layoutData` is fully backward-compatible.
// ─────────────────────────────────────────────────────────────────────────────

/** Round to 2 decimal places — keeps JSON compact for coordinates. */
function r2(v) { return Math.round(v * 100) / 100; }

/** Round to 4 decimal places — for normalised vertices (0-1 range). */
function r4(v) { return Math.round(v * 10000) / 10000; }

/**
 * Given a sorted list of numeric positions, merge any values that are within
 * `tolerance` units of the running group average.
 * Returns an array of merged center values (sorted ascending).
 */
function mergeClosePositions(sorted, tolerance) {
  if (!sorted.length) return [];
  const groups = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = groups[groups.length - 1];
    const avg = last.reduce((a, b) => a + b, 0) / last.length;
    if (sorted[i] - avg <= tolerance) last.push(sorted[i]);
    else groups.push([sorted[i]]);
  }
  return groups.map(g => r2(g.reduce((a, b) => a + b, 0) / g.length));
}

/**
 * Extract normalised vertices from a boundingPoly.
 * Document AI may supply either `normalizedVertices` (preferred, 0-1 range)
 * or `vertices` (pixel integers relative to the image).
 * We always prefer normalised; if only pixel vertices exist we normalise them
 * ourselves using pageWidth / pageHeight.
 */
function getNormVertices(boundingPoly, pageWidth, pageHeight) {
  const nv = boundingPoly?.normalizedVertices;
  if (nv && nv.length) {
    return nv.map(v => ({ x: Number(v.x || 0), y: Number(v.y || 0) }));
  }
  const pv = boundingPoly?.vertices;
  if (pv && pv.length && pageWidth && pageHeight) {
    return pv.map(v => ({
      x: Number(v.x || 0) / pageWidth,
      y: Number(v.y || 0) / pageHeight,
    }));
  }
  return [];
}

/**
 * Convert normalised vertices → axis-aligned bounding box in page coordinates.
 * Returns { x, y, width, height } or null if vertices are empty.
 */
function normVertsToBBox(normVerts, pageWidth, pageHeight) {
  if (!normVerts.length) return null;
  const xs = normVerts.map(v => v.x);
  const ys = normVerts.map(v => v.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    x: r2(minX * pageWidth),
    y: r2(minY * pageHeight),
    width:  r2((maxX - minX) * pageWidth),
    height: r2((maxY - minY) * pageHeight),
  };
}

/**
 * Extract text blocks from a single Document AI page.
 *
 * Priority order for granularity: lines → paragraphs → blocks.
 * Each block gets: text, confidence, boundingBox (page coords), normalizedVertices.
 * Sorted by ascending y, then ascending x.
 */
function extractTextBlocks(page, documentText, pageWidth, pageHeight) {
  // Pick the finest available granularity level on this page.
  const sources = page.lines?.length   ? page.lines
                : page.paragraphs?.length ? page.paragraphs
                : page.blocks || [];

  const blocks = [];

  for (const item of sources) {
    const text = getAnchoredText(documentText, item.layout);
    if (!text) continue;

    const normVerts = getNormVertices(item.layout?.boundingPoly, pageWidth, pageHeight);
    if (!normVerts.length) continue;

    const bbox = normVertsToBBox(normVerts, pageWidth, pageHeight);
    if (!bbox) continue;

    blocks.push({
      text,
      confidence: r4(item.layout?.confidence ?? 0),
      boundingBox: bbox,
      normalizedVertices: normVerts.map(v => ({ x: r4(v.x), y: r4(v.y) })),
    });
  }

  // Sort: top-to-bottom, then left-to-right
  blocks.sort((a, b) =>
    a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x
  );

  return blocks;
}

/**
 * Build gridCandidates from Document AI's structured table data.
 *
 * For each page.table → headerRows + bodyRows → cells → layout.boundingPoly:
 *   1. Convert each cell to a rect { x, y, width, height, text }.
 *   2. Collect all left/right x-edges and top/bottom y-edges.
 *   3. Merge nearby edges (tolerance 6 px) to snap grid lines.
 *   4. For each unique x: emit a vertical line spanning the y range of cells at that x.
 *   5. For each unique y: emit a horizontal line spanning the x range of cells at that y.
 *
 * If the document has no tables, returns { cells:[], verticalLines:[], horizontalLines:[] }.
 */
function buildGridCandidates(pages, pageWidth, pageHeight, documentText) {
  const cells = [];

  for (const page of pages) {
    for (const table of (page.tables || [])) {
      const allRows = [
        ...(table.headerRows || []),
        ...(table.bodyRows  || []),
      ];

      for (const row of allRows) {
        for (const cell of (row.cells || [])) {
          const text = getAnchoredText(documentText, cell.layout);
          const normVerts = getNormVertices(cell.layout?.boundingPoly, pageWidth, pageHeight);
          if (!normVerts.length) continue;

          const bbox = normVertsToBBox(normVerts, pageWidth, pageHeight);
          if (!bbox) continue;

          cells.push({ ...bbox, text });
        }
      }
    }
  }

  if (!cells.length) {
    return { cells: [], verticalLines: [], horizontalLines: [] };
  }

  // ── Derive vertical lines ──────────────────────────────────────────────────
  // Collect every left-edge (cell.x) and right-edge (cell.x + cell.width).
  // For each unique x position, record the y-span of cells touching that x.
  const xEdgeMap = new Map(); // rounded-x → { minY, maxY }

  function registerX(x, cellY, cellBottom) {
    const rx = Math.round(x);
    const cur = xEdgeMap.get(rx);
    if (!cur) xEdgeMap.set(rx, { minY: cellY, maxY: cellBottom });
    else { cur.minY = Math.min(cur.minY, cellY); cur.maxY = Math.max(cur.maxY, cellBottom); }
  }

  for (const c of cells) {
    const bottom = c.y + c.height;
    registerX(c.x,           c.y, bottom);
    registerX(c.x + c.width, c.y, bottom);
  }

  // Merge x-positions that are within 6 px of each other.
  const sortedX = [...xEdgeMap.keys()].sort((a, b) => a - b);
  const mergedX = mergeClosePositions(sortedX, 6);

  const verticalLines = mergedX.map(mx => {
    // Aggregate y-spans of all raw x-edges within ±6 px of merged x.
    let minY = Infinity, maxY = -Infinity;
    for (const [rx, span] of xEdgeMap) {
      if (Math.abs(rx - mx) <= 6) {
        minY = Math.min(minY, span.minY);
        maxY = Math.max(maxY, span.maxY);
      }
    }
    return { x: mx, y1: r2(minY), y2: r2(maxY) };
  }).sort((a, b) => a.x - b.x);

  // ── Derive horizontal lines ────────────────────────────────────────────────
  const yEdgeMap = new Map(); // rounded-y → { minX, maxX }

  function registerY(y, cellX, cellRight) {
    const ry = Math.round(y);
    const cur = yEdgeMap.get(ry);
    if (!cur) yEdgeMap.set(ry, { minX: cellX, maxX: cellRight });
    else { cur.minX = Math.min(cur.minX, cellX); cur.maxX = Math.max(cur.maxX, cellRight); }
  }

  for (const c of cells) {
    const right = c.x + c.width;
    registerY(c.y,            c.x, right);
    registerY(c.y + c.height, c.x, right);
  }

  const sortedY = [...yEdgeMap.keys()].sort((a, b) => a - b);
  const mergedY = mergeClosePositions(sortedY, 6);

  const horizontalLines = mergedY.map(my => {
    let minX = Infinity, maxX = -Infinity;
    for (const [ry, span] of yEdgeMap) {
      if (Math.abs(ry - my) <= 6) {
        minX = Math.min(minX, span.minX);
        maxX = Math.max(maxX, span.maxX);
      }
    }
    return { y: my, x1: r2(minX), x2: r2(maxX) };
  }).sort((a, b) => a.y - b.y);

  return { cells, verticalLines, horizontalLines };
}

/**
 * Top-level function: build the complete layoutData object from a Document AI
 * `document` response.
 *
 * Returns null (never throws) so an extraction failure never kills the API.
 */
function extractLayoutData(document) {
  try {
    const text  = document?.text || '';
    const pages = document?.pages || [];
    if (!pages.length) return null;

    // Use first page for dimensions (most documents are single-page scans).
    const page = pages[0];
    const dim  = page.dimension || {};

    // Document AI dimension unit is typically points (pt) for PDFs or
    // pixels for images. We expose raw values; Phase 2 can decide scaling.
    const pageWidth  = Number(dim.width  || 0) || 1000;
    const pageHeight = Number(dim.height || 0) || 1414;

    const textBlocks    = extractTextBlocks(page, text, pageWidth, pageHeight);
    const gridCandidates = buildGridCandidates(pages, pageWidth, pageHeight, text);

    return { pageWidth, pageHeight, textBlocks, gridCandidates };
  } catch (_) {
    // Never let layoutData extraction crash the API response.
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { image } = body;
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: '請上傳有效圖片。' });
    }

    const base64 = image.split(',')[1] || '';
    const sizeBytes = Math.ceil(base64.length * 0.75);
    if (sizeBytes > 5 * 1024 * 1024) {
      return res.status(413).json({ error: '圖片超過 5MB，請先壓縮後再上傳。' });
    }

    const projectId = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION;
    const processorId = process.env.GOOGLE_PROCESSOR_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !location || !processorId || !clientEmail || !privateKey) {
      return res.status(500).json({ error: '後端環境變數尚未設定完整。' });
    }

    const mimeType = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)?.[1] || 'image/jpeg';
    const accessToken = await getAccessToken(clientEmail, privateKey);
    const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rawDocument: { content: base64, mimeType } }),
    });

    if (!aiRes.ok) {
      return res.status(502).json({ error: 'OCR 服務暫時無法處理，請稍後再試。' });
    }

    const result = await aiRes.json();
    const document = result.document || {};
    const tableRows = parseTables(document);
    const rows = tableRows.length ? tableRows : parseFallbackText(document);
    const visual = buildVisual(document);

    // V1.4 Phase 1: layoutData for SVG reconstruction (Phase 2)
    // extractLayoutData wraps in try/catch and never throws.
    const layoutData = extractLayoutData(document);

    return res.status(200).json({ rows, visual, layoutData });
  } catch (error) {
    return res.status(500).json({ error: '辨識失敗，請確認圖片清晰度後重試。' });
  }
}
