export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.query.url || req.body?.url;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  try {
    // Validate URL structure
    const targetUrl = new URL(url);

    // Fetch the page content
    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : targetUrl.hostname;

    // Remove scripts, styles, headers, footers, navs, and iframes to extract body content
    let cleanedText = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<svg[^>]*>([\s\S]*?)<\/svg>/gi, '')
      .replace(/<nav[^>]*>([\s\S]*?)<\/nav>/gi, '')
      .replace(/<footer[^>]*>([\s\S]*?)<\/footer>/gi, '')
      .replace(/<header[^>]*>([\s\S]*?)<\/header>/gi, '')
      .replace(/<iframe[^>]*>([\s\S]*?)<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, ''); // Comments

    // Strip HTML Tags
    cleanedText = cleanedText.replace(/<[^>]*>/g, ' ');

    // Normalize spacing and decode basic entities
    cleanedText = cleanedText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit extracted text size to avoid inflating LLM context limits (e.g. max 15,000 chars)
    if (cleanedText.length > 15000) {
      cleanedText = cleanedText.substring(0, 15000) + '... (truncated)';
    }

    return res.status(200).json({
      url: targetUrl.toString(),
      title: title,
      content: cleanedText || 'No readable text content found.'
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return res.status(500).json({ error: `Scraping failed: ${error.message}` });
  }
}
