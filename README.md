# 🚀 Swift File Tools

**Swift File Tools** is a modern, high-performance, and privacy-first web application for all your PDF, Image, and Video processing needs. Built with a clean, premium design and an intuitive sidebar layout, it allows you to handle sensitive documents entirely within your browser — no data ever leaves your device.

![Logo](logo.png)

## ✨ Features

### 🤖 Swift Assistant
An integrated AI chat assistant powered by your choice of AI provider. Write emails, answer questions, generate remarks, edit drafts, and write code — all without leaving the app.
- **Multi-provider support**: Swift Assistant (Official), Google Gemini, OpenRouter, Groq Cloud, Hugging Face, or a Custom API endpoint.
- **Remarks Generator**: Quickly generate professional remarks and feedback.
- **Conversation History**: Save and resume multiple chat sessions.

### 🔍 Scanner
A real-time document scanner powered by OpenCV.js.
- Detects document edges directly from your camera or an uploaded image.
- Applies perspective correction and produces a clean, flat scan.
- Export the scan as a high-quality PDF or image.

### 📄 PDF Tools
- **Merge PDF**: Combine multiple PDF documents into a single file with drag-and-drop reordering.
- **Split PDF**: Extract specific pages or split a PDF into individual page files.
- **Compress PDF**: Reduce file size with an adjustable compression slider, showing live original vs. estimated size.
- **Unlock PDF**: Remove passwords and restrictions from protected PDF files.
- **Protect PDF**: Encrypt your documents with a strong password (128-bit RC4 encryption).
- **PDF to Image**: High-fidelity conversion of PDF pages to JPG/PNG images.
- **Redact PDF**: Permanently black-out sensitive text and areas from PDF documents.
- **Watermark**: Add custom text or image watermarks to your PDFs.
- **Word to PDF**: Convert `.docx` Word documents to PDF entirely in the browser via Mammoth.js & html2canvas.
- **Webpage to PDF**: Enter any URL and capture it as a PDF using html2canvas rendering.

### 🖼️ Image Tools
- **Image to PDF**: Convert photos (JPG, PNG, WebP, SVG, GIF, BMP, TIFF, etc.) into professional PDF documents.
- **Compress Image**: Intelligent compression with a live quality slider and real-time size estimation. Supports batch processing.
- **Background Remover**:
  - **AI Removal** (Cloud): Ultra-precise removal powered by the remove.bg API.
  - **Swift Removal** (Local): Fast, browser-based AI removal via `@imgly/background-removal` for maximum privacy.
  - Replace removed backgrounds with a solid color, gradient, or custom image.
  - Crop and rotate adjustments with a live preview.
- **Collage Maker**:
  - 10+ Artistic Layouts (Grid, Hero, Mosaic, Triptych, and more).
  - Real-time interactive zoom and per-cell framing with Cropper.js.
  - Customizable spacing, corner roundness, and background color/gradient.

### 🎬 Video Tools
- **Video Compressor**: Client-side video compression using the WebCodecs / MediaRecorder API.
  - Resolution presets: Original, 1080p, 720p, 480p, 360p.
  - Adjustable compression level with live size estimation.
  - Output formats: WebM (recommended) or MP4.
  - Interactive split-screen Original vs. Compressed live preview with a draggable comparison slider.
  - Custom video player controls: play/pause, step forward/back, frame-by-frame stepping, speed selection, and mute.

## 🛡️ Privacy & Security
Unlike traditional online converters, **Swift File Tools** performs all processing locally on your machine using JavaScript.
- **Zero Server Uploads**: Your files are never sent to a server (except when using the AI Removal cloud feature, which uses the remove.bg API).
- **Browser-Based**: All AI models and PDF engines run in your browser's sandbox.
- **Offline Capable**: Works without an internet connection once loaded (except cloud-dependent features).

## 🛠️ Technology Stack
- **PDF Processing**: [pdf-lib](https://github.com/Hopding/pdf-lib), [pdf.js](https://github.com/mozilla/pdf.js)
- **Document Generation**: [jsPDF](https://github.com/parallax/jsPDF)
- **Word Conversion**: [Mammoth.js](https://github.com/mwilliamson/mammoth.js)
- **HTML-to-Canvas Rendering**: [html2canvas](https://github.com/niklasvh/html2canvas)
- **OCR / Scanner**: [Tesseract.js](https://github.com/naptha/tesseract.js), [OpenCV.js](https://docs.opencv.org/4.5.4/opencv.js)
- **AI Background Removal**: [@imgly/background-removal](https://github.com/imgly/background-removal-js)
- **Image Editing**: [Cropper.js](https://github.com/fengyuanchen/cropperjs)
- **UI & Icons**: [Lucide Icons](https://lucide.dev/), CSS3 — Outfit font (Google Fonts)
- **Backend (optional)**: Express.js + `@distube/ytdl-core` (for server-side features in `server.js`)

## 🚀 Getting Started

### Browser (No Install)
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/swiftfile.git
   ```
2. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, Safari).
3. Start processing your files!

### Server (Optional)
For server-dependent features, run the included Node.js backend:
```bash
npm install
npm start
```

## 🖥️ UI & Layout
- **Resizable Sidebar**: A collapsible sidebar panel lists all tools with a live search filter.
- **Dark / Light Mode**: System-aware theme toggle available in both the header and sidebar footer.
- **Tool Search**: Instantly filter tools via the desktop sidebar search or the mobile search overlay.
- **Conversion History**: Track your recent file operations via the History button.
- **PWA Support**: Installable as a Progressive Web App via `manifest.json` and `sw.js`.

## 📱 Mobile Support
Swift File Tools is fully optimized for mobile devices with a responsive bottom navigation bar, a slide-up drawer for tool selection, and a compact top-bar search. The interface adapts seamlessly to phone and tablet screens.

## 📄 License
This project is licensed under the MIT License — see the LICENSE file for details.

---
*Built with ❤️ for a faster, more secure web.*
