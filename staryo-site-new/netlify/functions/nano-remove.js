// Netlify Function: nano-remove
// Receives a JSON payload with a base64-encoded image and an optional instruction.
// Uses the Gemini (Google generative language) API to remove an object from the image
// according to the instruction. Responds with a JSON object containing the base64
// encoded result image (without any data URI prefix).

exports.handler = async function(event, context) {
  // Determine the allowed origin from env or default to *.
  const allowOrigin = process.env.ALLOW_ORIGIN || '*';
  // Define a common set of CORS headers for all responses.
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    // Allow typical content-type header; extend as needed for other headers.
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }
  try {
    // Ensure POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
    const body = event.body ? JSON.parse(event.body) : {};
    const { image, instruction } = body;
    if (!image) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing image' }),
      };
    }
    const apiKey = process.env.NANO_API_KEY;
    const model = process.env.NANO_MODEL || 'gemini-2.5-flash-image-preview';
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NANO_API_KEY not set' }),
      };
    }
    // Extract base64 data and MIME type
    let base64Data = image;
    let mime = 'image/jpeg';
    const dataUriMatch = /^data:(.*?);base64,(.*)$/.exec(image);
    if (dataUriMatch) {
      mime = dataUriMatch[1];
      base64Data = dataUriMatch[2];
    } else {
      // If the string is raw base64, keep as is
      base64Data = image;
    }
    const prompt = instruction || 'remove unwanted objects from the image';
    // Build Gemini request payload
    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mime,
                data: base64Data,
              },
            },
          ],
        },
      ],
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(geminiBody),
    });
    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Gemini API error', details: text }),
      };
    }
    const result = await response.json();
    // Find the first image in the response
    let outData;
    const candidates = result?.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.inline_data && part.inline_data.data) {
            outData = part.inline_data.data;
            break;
          }
        }
      }
    }
    if (!outData) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No image returned from Gemini' }),
      };
    }
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: outData }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || err.toString() }),
    };
  }
};