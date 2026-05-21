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

    // Some Document AI OCR responses expose text only through blocks/paragraphs.
    // Keep this fallback conservative so it never blocks normal OCR output.
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

function parseTwoColumnLayout(document) {
  const items = collectLayoutItems(document);
  if (items.length < 6) return [];

  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const minX = xs[0], maxX = xs[xs.length - 1];
  if (maxX - minX < 0.28) return [];

  // Split by median x-position. This works better for photographed forms than
  // assuming a perfect 50/50 page split.
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

function parseFallbackText(document) {
  const layoutRows = parseTwoColumnLayout(document);
  if (layoutRows.length) return layoutRows;

  const text = document?.text || '';
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [{ 段落: '' }];
  return lines.map((line, index) => ({ 行號: String(index + 1), 段落: line }));
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

    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: '辨識失敗，請確認圖片清晰度後重試。' });
  }
}
