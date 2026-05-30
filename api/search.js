export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query.q || req.query.query || req.body?.query;
  const location = req.query.location || req.body?.location;

  if (!query) {
    return res.status(400).json({ error: 'Search query parameter (q) is required.' });
  }

  // Augment search query with location if it has local-intent and location is provided
  let searchQuery = query;
  if (location) {
    const localKeywords = ['weather', 'time', 'news', 'today', 'temp', 'forecast', 'local', 'current', 'hour', 'date'];
    const queryLower = query.toLowerCase();
    const isLocal = localKeywords.some(keyword => queryLower.includes(keyword));
    if (isLocal) {
      const locationParts = location.split(',').map(p => p.trim().toLowerCase());
      const alreadyHasLocation = locationParts.some(part => part && queryLower.includes(part));
      if (!alreadyHasLocation) {
        searchQuery = `${query} in ${location}`;
      }
    }
  }

  const results = [];

  try {
    // 1. Try Google Search
    try {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
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
        const matches = html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(?:[\s\S]*?)<h3[^>]*>([\s\S]*?)<\/h3>/g);
        for (const match of matches) {
          let url = match[1];
          let title = match[2].replace(/<[^>]*>/g, '').trim(); // Strip title HTML

          if (url.startsWith('/url?q=')) {
            url = url.substring(7).split('&')[0];
          }

          if (url.startsWith('//')) {
            url = 'https:' + url;
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
    } catch (googleError) {
      console.warn('Google search fetch failed, moving to fallbacks:', googleError.message);
    }

    // 2. Fallback to DuckDuckGo Lite if Google returned nothing
    if (results.length === 0) {
      console.log('Google search returned no hits. Falling back to DuckDuckGo Lite...');
      try {
        const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(searchQuery)}`;
        const ddgRes = await fetch(ddgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://lite.duckduckgo.com/'
          }
        });

        if (ddgRes.ok) {
          const html = await ddgRes.text();
          
          // Robust tag-level parser for DuckDuckGo Lite
          const aTagRegex = /<a\s+[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;
          const snippetRegex = /<td\s+[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi;
          
          const tempLinks = [];
          let match;
          while ((match = aTagRegex.exec(html)) !== null) {
            const fullTag = match[0];
            const title = match[1].replace(/<[^>]*>/g, '').trim();
            const hrefMatch = fullTag.match(/href=['"]([^'"]+)['"]/i);
            let url = hrefMatch ? hrefMatch[1] : '';
            
            if (url.includes('uddg=')) {
              const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
              if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1]);
              }
            }
            if (url.startsWith('//')) {
              url = 'https:' + url;
            }
            tempLinks.push({ title, url });
          }

          const snippets = [];
          while ((match = snippetRegex.exec(html)) !== null) {
            snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
          }

          for (let i = 0; i < Math.min(tempLinks.length, 5); i++) {
            results.push({
              title: decodeHtmlEntities(tempLinks[i].title),
              url: tempLinks[i].url,
              snippet: decodeHtmlEntities(snippets[i] || 'Click link to read.')
            });
          }
        }
      } catch (ddgLiteError) {
        console.warn('DuckDuckGo Lite fetch failed:', ddgLiteError.message);
      }
    }

    // 3. Fallback to DuckDuckGo HTML if DuckDuckGo Lite and Google returned nothing
    if (results.length === 0) {
      console.log('DuckDuckGo Lite returned no hits. Falling back to DuckDuckGo HTML Search...');
      try {
        const ddgHtmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
        const ddgHtmlRes = await fetch(ddgHtmlUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          }
        });

        if (ddgHtmlRes.ok) {
          const html = await ddgHtmlRes.text();
          const linkRegex = /<a\s+[^>]*class=['"]result__a['"][^>]*>([\s\S]*?)<\/a>/gi;
          const snippetRegex = /<a\s+[^>]*class=['"]result__snippet['"][^>]*>([\s\S]*?)<\/a>/gi;

          const tempLinks = [];
          let match;
          while ((match = linkRegex.exec(html)) !== null) {
            const fullTag = match[0];
            const title = match[1].replace(/<[^>]*>/g, '').trim();
            const hrefMatch = fullTag.match(/href=['"]([^'"]+)['"]/i);
            let url = hrefMatch ? hrefMatch[1] : '';

            if (url.includes('uddg=')) {
              const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
              if (uddgMatch) {
                url = decodeURIComponent(uddgMatch[1]);
              }
            }
            if (url.startsWith('//')) {
              url = 'https:' + url;
            }
            tempLinks.push({ title, url });
          }

          const snippets = [];
          while ((match = snippetRegex.exec(html)) !== null) {
            snippets.push(match[1].replace(/<[^>]*>/g, '').trim());
          }

          for (let i = 0; i < Math.min(tempLinks.length, 5); i++) {
            results.push({
              title: decodeHtmlEntities(tempLinks[i].title),
              url: tempLinks[i].url,
              snippet: decodeHtmlEntities(snippets[i] || 'Click link to read.')
            });
          }
        }
      } catch (ddgHtmlError) {
        console.warn('DuckDuckGo HTML search fetch failed:', ddgHtmlError.message);
      }
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({ error: `Search API failed: ${error.message}` });
  }
}

function decodeHtmlEntities(text) {
  if (!text) return '';
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
