async function getActiveCobaltAPIs() {
  try {
    const res = await fetch('https://cobalt.directory/');
    if (!res.ok) return ['https://apicobalt.mgytr.top'];
    const html = await res.text();
    
    const regex = /<tr[^>]*><td>.*?<\/td><td>([^<]+)<\/td>/g;
    let match;
    const apis = [];
    while ((match = regex.exec(html)) !== null) {
      const host = match[1].trim();
      if (host && !host.includes('Offline') && !host.includes('—')) {
        apis.push(`https://${host}`);
      }
    }
    // Prioritize apicobalt.mgytr.top as we know it works, and fall back to others
    const finalApis = ['https://apicobalt.mgytr.top', ...apis.filter(a => a !== 'https://apicobalt.mgytr.top')];
    return finalApis;
  } catch (e) {
    return ['https://apicobalt.mgytr.top'];
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, url, format_id } = req.query;

  if (!url) {
    return res.status(200).json({ error: "Missing 'url' parameter." });
  }

  try {
    if (action === 'info') {
      // Use YouTube Oembed to fetch video title and thumbnail safely
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const oembedRes = await fetch(oembedUrl);
      
      let title = "YouTube Video";
      let thumbnail = "";
      
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = oembedData.title || title;
        thumbnail = oembedData.thumbnail_url || "";
      } else {
        // Fallback title extraction from URL if oembed fails
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        const videoId = (match && match[2].length === 11) ? match[2] : null;
        if (videoId) {
          thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }

      const responseData = {
        title: title,
        thumbnail: thumbnail,
        duration: 0,
        formats: [
          {
            format_id: '1080',
            resolution: '1080p (Full HD)',
            ext: 'mp4',
            note: 'High Quality',
            filesize: 0,
            is_audio: false
          },
          {
            format_id: '720',
            resolution: '720p (HD)',
            ext: 'mp4',
            note: 'Recommended',
            filesize: 0,
            is_audio: false
          },
          {
            format_id: '480',
            resolution: '480p',
            ext: 'mp4',
            note: '',
            filesize: 0,
            is_audio: false
          },
          {
            format_id: '360',
            resolution: '360p',
            ext: 'mp4',
            note: '',
            filesize: 0,
            is_audio: false
          },
          {
            format_id: 'audio',
            resolution: 'Audio Only (MP3)',
            ext: 'mp3',
            note: 'Best Audio',
            filesize: 0,
            is_audio: true
          }
        ]
      };

      return res.status(200).json(responseData);

    } else if (action === 'download') {
      const isAudio = format_id === 'audio';
      const quality = isAudio ? 'max' : (format_id || '720');

      const cobaltApis = await getActiveCobaltAPIs();
      let lastError = 'No working download server found.';
      
      // Attempt to fetch from active public Cobalt instances sequentially until one succeeds
      for (const apiEndpoint of cobaltApis) {
        try {
          const cobaltResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: url,
              videoQuality: quality,
              isAudioOnly: isAudio,
              filenamePattern: 'basic'
            })
          });

          if (!cobaltResponse.ok) {
            continue;
          }

          const cobaltData = await cobaltResponse.json();
          
          if (cobaltData.status === 'error' || cobaltData.error) {
            lastError = cobaltData.text || cobaltData.error?.code || 'Instance error';
            continue;
          }

          const directUrl = cobaltData.url;
          if (directUrl) {
            // Successfully retrieved direct URL, perform 302 redirect
            res.writeHead(302, { Location: directUrl });
            return res.end();
          }
        } catch (e) {
          lastError = e.message;
          continue;
        }
      }

      // If all servers fail, return error JSON
      return res.status(200).json({ error: `Downloader Error: ${lastError}` });

    } else {
      return res.status(200).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(200).json({ error: `Server error: ${err.message}` });
  }
}
