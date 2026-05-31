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
      // Use YouTube Oembed to fetch video title and thumbnail safely (bypasses any blocking)
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

      // Return a structured response matching what index.html expects
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

      // Request to Cobalt API
      const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
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
        const errText = await cobaltResponse.text();
        return res.status(200).json({ error: `Downloader API error: ${errText || cobaltResponse.statusText}` });
      }

      const cobaltData = await cobaltResponse.json();
      
      if (cobaltData.status === 'error') {
        return res.status(200).json({ error: cobaltData.text || 'Error from downloader API.' });
      }

      const directUrl = cobaltData.url;
      if (!directUrl) {
        return res.status(200).json({ error: 'No download URL returned from API.' });
      }

      // Fetch the file stream from Cobalt to proxy it (bypassing CORS)
      const fileRes = await fetch(directUrl);
      if (!fileRes.ok) {
        return res.status(200).json({ error: 'Failed to fetch the stream from video source.' });
      }

      // Forward headers
      const contentType = fileRes.headers.get('Content-Type') || (isAudio ? 'audio/mpeg' : 'video/mp4');
      const contentLength = fileRes.headers.get('Content-Length');

      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Content-Disposition', `attachment; filename="download.${isAudio ? 'mp3' : 'mp4'}"`);

      // Pipe the body stream directly to client response
      const readableStream = fileRes.body;
      if (readableStream.pipe) {
        readableStream.pipe(res);
      } else {
        // Node-fetch body in newer versions might be a Web ReadableStream
        for await (const chunk of readableStream) {
          res.write(chunk);
        }
        res.end();
      }

    } else {
      return res.status(200).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(200).json({ error: `Server error: ${err.message}` });
  }
}
