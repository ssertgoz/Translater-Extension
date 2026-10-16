# Quick Selection Translator

A Chrome extension that translates selected text immediately into Turkish on web pages and PDFs opened in its bundled PDF.js viewer. Change the target language from the extension popup.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. For a web page, select text; the translation starts immediately.
5. To view a PDF already open in Chrome, click the extension and choose **Open current tab in PDF viewer**. It opens directly in the bundled viewer. Local PDFs can also be opened from their current tab if Chrome grants file access; otherwise choose **Open a PDF file**.
6. Select text in the extension's PDF viewer; translation starts immediately. Use the left and right arrow keys to move between pages when a toolbar control is not focused.
7. Use **Enable automatic translation** in the extension popup to pause or resume webpage/PDF translations and PDF-link redirection. Manual PDF viewing remains available while paused.
8. Optionally enable **Open direct .pdf links in this viewer** in the extension popup. Chrome will ask for HTTP/HTTPS website access so the extension can open matching links.

Chrome does not let extensions read selections in its built-in PDF viewer or replace it as the system default. The optional link toggle only handles `.pdf` links clicked on web pages; it does not handle PDFs typed into the address bar, local files, downloads, or links without a `.pdf` URL. For local files opened by URL, enable **Allow access to file URLs** in the extension details if Chrome blocks access. Text longer than 5,000 characters is ignored. Selected text is sent to Google's public translation endpoint for translation. Line wraps in selected text are normalized before translation, while blank lines between paragraphs are preserved.
