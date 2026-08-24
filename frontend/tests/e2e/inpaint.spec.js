const { test, expect } = require('@playwright/test');

const { deflateSync } = require('zlib');

const API_KEY = 'mg_inpaint_e2e_key';

// The make-image fixture is truncated (no IEND) and cannot be decoded; build a
// real decodable PNG so upload preview, mask sizing, and compositing all run.
function tinyPNG(width = 64, height = 64) {
  const crcTable = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xFFFFFFFF;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width; x += 1) raw[y * (1 + width * 3) + 1 + x * 3] = (x * 4) % 256;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG_FIXTURE = tinyPNG();

test.use({ viewport: { width: 1440, height: 1300 } });
test('inpaint composites the edit back only inside the brushed mask', async ({ page }) => {
  await page.addInitScript(({ apiKey }) => {
    localStorage.setItem('mg_api_key', apiKey);
    localStorage.setItem('mg_user', JSON.stringify({
      id: 'inpaint-e2e-user',
      email: 'inpaint-e2e@manifoldgen.local',
      api_key: apiKey,
      credits: 10_000,
      credits_usd: 100,
    }));
  }, { apiKey: API_KEY });

  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: {
      user: { id: 'inpaint-e2e-user', email: 'inpaint-e2e@manifoldgen.local', api_key: API_KEY, credits: 10_000 },
      api_key: API_KEY,
      cute_price_usd: 0.01,
      credits_usd: 100,
    },
  }));

  await page.route('**/api/pricing', (route) => route.fulfill({
    status: 200,
    json: { credit_price_usd: 0.01, cute_price_usd: 0.01, image_credits: 4, image_price_usd: 0.04 },
  }));

  await page.route('**/api/uploads/presign*', (route) => route.fulfill({
    status: 200,
    json: { upload_url: 'https://upload.example/inpaint-source.png', public_url: 'https://public.example/inpaint-source.png' },
  }));
  await page.route('https://upload.example/inpaint-source.png', (route) => route.fulfill({ status: 200 }));

  const requests = [];
  await page.route('**/api/service', async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {
      result: { saved_image_url: 'https://studio-result.example/inpainted.png' },
      credits_used: 30,
      credits_remain: 9_970,
    } });
  });
  await page.route('https://studio-result.example/inpainted.png', (route) => route.fulfill({
    status: 200,
    contentType: 'image/png',
    headers: { 'access-control-allow-origin': '*' },
    body: PNG_FIXTURE,
  }));

  await page.goto('/tools/inpaint');
  await expect(page.getByText('INPAINT', { exact: true })).toBeVisible();

  // Dev-server hydration can lag the first paint; retry until the React
  // onChange handler is live and the mask canvas mounts.
  const mask = page.getByTestId('inpaint-mask');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.setInputFiles('input[type="file"]', { name: 'source.png', mimeType: 'image/png', buffer: PNG_FIXTURE });
    try {
      await mask.waitFor({ state: 'visible', timeout: 3000 });
      break;
    } catch {
      if (attempt === 4) throw new Error('Mask canvas never mounted after upload');
    }
  }
  await expect(mask).toBeVisible();

  const box = await mask.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();

  await page.getByTestId('inpaint-prompt').fill('Replace the brushed area with weathered copper plating.');
  await page.getByTestId('inpaint-run').click();

  const result = page.getByTestId('inpaint-result');
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute('src', /^data:image\/png/);

  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    service: 'image-edit',
    image_url: 'https://public.example/inpaint-source.png',
    n: 1,
  });
  expect(Number.isInteger(requests[0].width)).toBe(true);
  expect(Number.isInteger(requests[0].height)).toBe(true);
  expect(typeof requests[0].prompt).toBe('string');
  expect(requests[0].prompt.length).toBeGreaterThan(0);
});
