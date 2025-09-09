exports.handler = async function() {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      ok: true,
      ts: Date.now(),
      env: process.env.CONTEXT || 'prod',
      version: process.env.APP_VERSION || '0.1.0'
    })
  };
};
