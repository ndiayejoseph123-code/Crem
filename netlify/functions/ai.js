// netlify/functions/ai.js
// Proxy Mistral API — clé cachée dans MISTRAL_API_KEY (variable Netlify)

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
  if (!MISTRAL_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Clé API Mistral non configurée dans les variables Netlify.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide.' }) };
  }

  const { type, chapter_title, chapter_content, question, correction, answer } = body;

  let messages;

  if (type === 'exercises') {
    if (!chapter_title || !chapter_content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Données manquantes.' }) };
    }
    messages = [
      {
        role: 'system',
        content: `Tu es un professeur expert et bienveillant pour des étudiants sénégalais.
Génère des exercices pédagogiques pertinents et variés basés sur le cours fourni.
Réponds UNIQUEMENT en JSON valide, sans backticks ni texte autour.
Format strict : {"questions":[{"question":"...","correction":"..."},{"question":"...","correction":"..."},{"question":"...","correction":"..."}]}
Les corrections doivent être détaillées, claires et pédagogiques.`,
      },
      {
        role: 'user',
        content: `Génère 3 exercices variés (compréhension, application, analyse) pour ce cours.\n\nTitre: ${chapter_title}\n\nContenu:\n${chapter_content.slice(0, 2000)}`,
      },
    ];
  } else if (type === 'grade') {
    if (!question || !correction || !answer) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Données manquantes.' }) };
    }
    messages = [
      {
        role: 'system',
        content: `Tu es un correcteur bienveillant et précis pour des étudiants sénégalais.
Note la réponse de l'élève sur 10 en comparant avec la correction officielle.
Sois encourageant et constructif dans ton feedback.
Réponds UNIQUEMENT en JSON valide : {"note":7,"feedback":"retour constructif et encourageant"}`,
      },
      {
        role: 'user',
        content: `Question : ${question}\n\nCorrection officielle : ${correction}\n\nRéponse de l'élève : ${answer}\n\nDonne une note sur 10 et un feedback motivant.`,
      },
    ];
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Type invalide. Utilise "exercises" ou "grade".' }) };
  }

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MISTRAL_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: 1600,
        temperature: 0.7,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `Erreur Mistral : ${err}` }),
      };
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content || '{}';
    const clean = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Erreur serveur : ${err.message}` }),
    };
  }
};
      
