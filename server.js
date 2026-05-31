const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Fetch Video Metadata
app.get('/api/yt', async (req, res) => {
  const { action, url, format_id } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing 'url' parameter." });
  }

  try {
    if (action === 'info') {
      const info = await ytdl.getInfo(url);
      
      const formatsList = info.formats
        .filter(f => (f.hasVideo && f.hasAudio) || (!f.hasVideo && f.hasAudio)) // combined video+audio or audio-only
        .map(f => {
          const isAudio = !f.hasVideo && f.hasAudio;
          return {
            format_id: f.itag.toString(),
            resolution: isAudio ? 'Audio Only (MP3/M4A)' : (f.qualityLabel || `${f.height}p`),
            ext: isAudio ? 'mp3' : 'mp4',
            note: isAudio ? `${f.audioBitrate}kbps` : '',
            filesize: parseInt(f.contentLength) || 0,
            is_audio: isAudio
          };
        });

      // Reverse list to show highest quality first
      formatsList.reverse();

      return res.json({
        title: info.videoDetails.title,
        thumbnail: info.videoDetails.thumbnails[0]?.url || '',
        duration: parseInt(info.videoDetails.lengthSeconds) || 0,
        formats: formatsList
      });

    } else if (action === 'download') {
      const itag = parseInt(format_id);
      if (!itag) {
        return res.status(400).json({ error: "Missing or invalid 'format_id'." });
      }

      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, { quality: itag });

      if (!format) {
        return res.status(404).json({ error: "Requested format not found." });
      }

      // Stream the video/audio directly from YouTube to the client
      const title = info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_');
      const isAudio = !format.hasVideo && format.hasAudio;

      res.setHeader('Content-Disposition', `attachment; filename="${title}.${isAudio ? 'mp3' : 'mp4'}"`);
      res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');
      
      if (format.contentLength) {
        res.setHeader('Content-Length', format.contentLength);
      }

      ytdl(url, { format: format }).pipe(res);

    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
