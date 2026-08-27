export async function POST(req) {
  try {
    const body = await req.json();
    const { baseUrl, apiKey, ...rest } = body;
    if (!baseUrl || !apiKey) {
      return new Response(JSON.stringify({ error: 'baseUrl and apiKey required' }), { status: 400 });
    }
    const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rest),
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
