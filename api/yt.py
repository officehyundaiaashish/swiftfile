from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import urllib.request
import yt_dlp

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            # Parse query params
            parsed_path = urllib.parse.urlparse(self.path)
            query = urllib.parse.parse_qs(parsed_path.query)
            
            action = query.get('action', ['info'])[0]
            video_url = query.get('url', [''])[0]
            
            if not video_url:
                self.send_error_response(400, "Missing 'url' parameter.")
                return

            if action == 'info':
                self.handle_info(video_url)
            elif action == 'download':
                format_id = query.get('format_id', [''])[0]
                self.handle_download(video_url, format_id)
            else:
                self.send_error_response(400, f"Unknown action: {action}")
        except Exception as e:
            self.send_error_response(500, f"Server Error: {str(e)}")

    def handle_info(self, url):
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'cachedir': False,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios']
                }
            }
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Filter formats to return only useful ones (combined video+audio or best audio)
                formats_list = []
                formats = info.get('formats', [])
                
                # Best audio only format
                best_audio = None
                best_audio_bitrate = 0
                
                for f in formats:
                    # Check if audio only
                    if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                        abr = f.get('abr', 0) or 0
                        if abr > best_audio_bitrate:
                            best_audio_bitrate = abr
                            best_audio = f

                # Add Best Audio option
                if best_audio:
                    formats_list.append({
                        'format_id': best_audio.get('format_id'),
                        'resolution': 'Audio Only (MP3/M4A)',
                        'ext': 'mp3',
                        'note': f"{int(best_audio_bitrate)}kbps",
                        'filesize': best_audio.get('filesize') or best_audio.get('filesize_approx') or 0,
                        'is_audio': True
                    })

                # Combined video+audio formats
                for f in formats:
                    vcodec = f.get('vcodec', 'none')
                    acodec = f.get('acodec', 'none')
                    if vcodec != 'none' and acodec != 'none':
                        res = f.get('resolution') or f"{f.get('height')}p"
                        note = f.get('format_note') or ''
                        formats_list.append({
                            'format_id': f.get('format_id'),
                            'resolution': res,
                            'ext': f.get('ext', 'mp4'),
                            'note': note,
                            'filesize': f.get('filesize') or f.get('filesize_approx') or 0,
                            'is_audio': False
                        })
                
                # Reverse list to show highest resolution first
                formats_list.reverse()

                response_data = {
                    'title': info.get('title'),
                    'thumbnail': info.get('thumbnail'),
                    'duration': info.get('duration'),
                    'formats': formats_list
                }
                
                self.send_json_response(200, response_data)
        except Exception as e:
            self.send_error_response(500, f"Error extracting video info: {str(e)}")

    def handle_download(self, url, format_id):
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'cachedir': False,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios']
                }
            }
        }
        if format_id:
            ydl_opts['format'] = format_id

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Find direct download URL
                direct_url = info.get('url')
                title = info.get('title', 'video')
                ext = info.get('ext', 'mp4')

                # Sanitize filename
                safe_title = "".join([c if c.isalnum() or c in "._-" else "_" for c in title])

                # Handle audio conversion naming extension
                # If format is audio only, let's download it as mp3
                if info.get('vcodec') == 'none' or format_id == 'bestaudio':
                    ext = 'mp3'

                if not direct_url:
                    # Fallback to check specific format URL
                    formats = info.get('formats', [])
                    for f in formats:
                        if f.get('format_id') == format_id:
                            direct_url = f.get('url')
                            ext = f.get('ext', ext)
                            break

                if not direct_url:
                    self.send_error_response(404, "Could not find a direct download URL.")
                    return

                # Request to proxy the video stream
                req = urllib.request.Request(
                    direct_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Range': 'bytes=0-' # request full stream
                    }
                )

                with urllib.request.urlopen(req) as response:
                    content_length = response.getheader('Content-Length')
                    content_type = response.getheader('Content-Type') or 'video/mp4'

                    if ext == 'mp3':
                        content_type = 'audio/mpeg'

                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Disposition', f'attachment; filename="{safe_title}.{ext}"')
                    if content_length:
                        self.send_header('Content-Length', content_length)
                    self.end_headers()

                    # Stream chunks to client
                    chunk_size = 1024 * 64
                    while True:
                        chunk = response.read(chunk_size)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
        except Exception as e:
            self.send_error_response(500, f"Error streaming video file: {str(e)}")

    def send_json_response(self, status, data):
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_response(self, status, message):
        # Return 200 OK so Vercel doesn't intercept it with a default HTML 500 error page,
        # but specify the actual internal status code and error message in the JSON body.
        self.send_json_response(200, {'error': message, 'status': status})

