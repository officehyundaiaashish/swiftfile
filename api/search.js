export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query.q || req.query.query || req.body?.query;

  if (!query) {
    return res.status(400).json({ error: 'Search query parameter (q) is required.' });
  }

  const results = [];

  try {
    // 1. Try Google Search
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const googleRes = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (googleRes.ok) {
      const html = await googleRes.text();
      
      // Match result blocks (a href matched with h3 title)
      const matches = html.matchAll(/<a href="([^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/g);
      for (const match of matches) {
        let url = match[1];
        let title = match[2].replace(/<[^>]*>/g, '').trim(); // Strip title HTML

        if (url.startsWith('/url?q=')) {
          url = url.substring(7).split('&')[0];
        }

        if (url.startsWith('http') && !url.includes('google.com')) {
          results.push({
            title: decodeHtmlEntities(title),
            url: decodeURIComponent(url),
            snippet: 'View source page for full details.'
          });
        }
        if (results.length >= 5) break;
      }
    }

    // 2. Fallback to DuckDuckGo Lite if Google returned nothing
    if (results.length === 0) {
      console.log('Google search returned no hits. Falling back to DuckDuckGo Lite...');
      const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const ddgRes = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        }
      });

      if (ddgRes.ok) {
        const html = await ddgRes.text();
        // Extract link elements
        const linkMatches = [...html.matchAll(/<a class="result-link" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
        // Extract snippet elements
        const snippetMatches = [...html.matchAll(/<td class="result-snippet">([\s\S]*?)<\/td>/g)];

        for (let i = 0; i < Math.min(linkMatches.length, 5); i++) {
          const url = linkMatches[i][1];
          const title = linkMatches[i][2].replace(/<[^>]*>/g, '').trim();
          const snippet = snippetMatches[i] ? snippetMatches[i][1].replace(/<[^>]*>/g, '').trim() : 'Click link to read.';
          
          results.push({
            title: decodeHtmlEntities(title),
            url: decodeURIComponent(url),
            snippet: decodeHtmlEntities(snippet)
          });
        }
      }
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({ error: `Search API failed: ${error.message}` });
  }
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}
