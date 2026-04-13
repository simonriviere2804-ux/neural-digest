export const config = { runtime: 'edge' };

export default async function handler(req) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const NEWS_API_KEY = process.env.NEWS_API_KEY;

  if (!GROQ_API_KEY || !NEWS_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing API keys' }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const newsRes = await fetch(`https://newsapi.org/v2/everything?q=artificial+intelligence+OR+ChatGPT+OR+Gemini+OR+LLM&from=${sevenDaysAgo}&sortBy=popularity&pageSize=20&apiKey=${NEWS_API_KEY}`);
    const newsData = await newsRes.json();

    const articles = (newsData.articles || [])
      .filter(a => a.title && a.description && a.title !== '[Removed]')
      .slice(0, 15)
      .map(a => `TITRE: ${a.title}\nSOURCE: ${a.source?.name}\nDESC: ${a.description}`)
      .join('\n---\n');

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: `Tu es expert IA. Voici des actualités récentes:\n\n${articles}\n\nSélectionne les 7 plus importantes. Réponds UNIQUEMENT en JSON valide, sans backticks:\n[{"titre":"...","categorie":"Recherche|Industrie|Éthique & Société|Produits|Politique & Régulation","resume":"3-4 phrases en français","pourquoi_important":"1 phrase","impact_score":8,"source":"..."}]` }],
        temperature: 0.4,
        max_tokens: 3000,
      })
    });

    const groqData = await groqRes.json();
    const text = groqData.choices?.[0]?.message?.content || '';
    const match = text.replace(/```json|```/g, '').match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON found');

    return new Response(JSON.stringify({ articles: JSON.parse(match[0]), generated_at: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
