// Netlify Function: nano-remove
// Removes objects from an image using upstream Nano Banana API.

const allowOrigin = process.env.ALLOW_ORIGIN || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ok = (data, took = 0) => ({
  statusCode: 200,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: true, result: data, meta: { took_ms: took } })
});

const fail = (code, err) => ({
  statusCode: code,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: false, error: err })
});

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return fail(405, { code: 'METHOD_NOT_ALLOWED' });
  }

  const started = Date.now();
  try {
    const { image, prompt = 'remove test', strength = 0.85 } = JSON.parse(event.body || '{}');
    if (!image) return fail(400, { code: 'BAD_INPUT', message: 'image required' });

    const base64 = image.startsWith('data:')
      ? image.split(',')[1]
      : (image.startsWith('http') ? null : image);

    const upstreamUrl = process.env.NANO_API_URL;
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.NANO_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.NANO_API_KEY}`;
    }

    const payload = base64
      ? { image_base64: base64, prompt, strength }
      : { image_url: image, prompt, strength };

    console.log('nano-remove payload', { ...payload, image_base64: payload.image_base64 ? '<omitted>' : undefined });

    const res = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log('nano-remove upstream status', res.status);

    if (!res.ok) {
      return fail(res.status, {
        code: 'UPSTREAM_ERROR',
        message: 'Upstream returned error',
        upstream: { status: res.status, body: text }
      });
    }

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return ok(data, Date.now() - started);
  } catch (e) {
    console.error('nano-remove error', e);
    return fail(500, { code: 'UNEXPECTED', message: e.message || String(e) });
  }
};
