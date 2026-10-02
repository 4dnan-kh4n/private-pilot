# PrivatePilot browser extension

PrivatePilot is a local-first Manifest V3 prototype for reviewing webpage context before asking the controlled PrivatePilot assistant. On an ordinary HTTP or HTTPS page, it walks visible text nodes and form controls, masks detected values in the page, and keeps the temporary original-value map in the content script's memory. The map is discarded on a full page navigation/reload, when the tab or frame closes, or when the user selects **Clear**. It is never written to browser storage or logged.

The extension sends only its reviewed, redacted text and the user's question to the assistant endpoint configured by `ASSISTANT_ENDPOINT` in `sidepanel.js` (default: `http://localhost:3000/api/privatepilot/assist`). No webpage content, screenshot, OCR result, password, cookie, or placeholder map is sent to that endpoint. The local Node server rejects common unredacted patterns as a second check. Configure the endpoint host in `manifest.json` if you deploy the backend somewhere else.

## Load unpacked

1. Start the local assistant server from `private-pilot-testing` with `npm start` (MongoDB is needed only for the profile demo; the assistant endpoint can use local demo mode).
2. Open `chrome://extensions` in Chrome or Chromium and turn on **Developer mode**.
3. Choose **Load unpacked** and select this `extension` folder.
4. Open a normal HTTP or HTTPS page, then click the PrivatePilot toolbar button.
5. Grant access to the current site when Chrome asks. The extension injects into accessible frames and opens its side panel. Site access is optional and can be revoked in Chrome's extension settings.
6. Choose **Review Local Context**. Check both previews; ask a question only after the safe preview looks right.
7. To test image text, choose **Run Visual Scan**. Capture and OCR are local; the screenshot is held in memory and discarded after recognition.

The extension does not run on `chrome://` pages, Chrome Web Store pages, extension pages, or other browser-protected documents. Injection uses `activeTab` after the toolbar click. The optional host permission is requested for the current origin so the extension can reinject after that site's navigation. Cross-origin frames require permission to their own origins; same-origin frames are scanned with the page. The assistant backend host has a separate narrow permission so a visit to an unrelated website does not redirect the assistant request to that website.

## Permissions

- `activeTab` — temporary access to the page the user selected by clicking the toolbar button.
- `scripting` — inject the local scanner into the selected tab and its permitted frames.
- `sidePanel` — present the local review, assistant, and approval controls.
- `http://localhost:3000/*` host permission — contact the default local PrivatePilot assistant backend.
- Optional `http://*/*` and `https://*/*` host access — allow the user to grant a site origin for reinjection after navigation. The extension does not request permanent access to every site at installation.
- Web-accessible Tesseract worker, WebAssembly core, and English model — let the extension's local OCR worker load its bundled assets under Manifest V3. No CDN or runtime model download is used.

## Supported detection

Heuristic rules cover email addresses; Indian phone numbers; PAN; Aadhaar; IFSC; labelled 9–18 digit account numbers; Luhn-checked payment card numbers; UPI IDs; labelled PIN codes; dates of birth; labelled names and addresses; and password, OTP, and card security fields. Password fields and controls identified by password/OTP/card autocomplete or labels are never read into the extension message and are visually masked. Values in ordinary text are detected by format and by nearby labels where possible. Identical detected values reuse one placeholder during the tab session.

## Limitations and safe use

- This is a prototype, not a guarantee that all sensitive information will be found. Unknown formats, image quality, OCR errors, language, unusual labels, or content assembled in inaccessible frames can cause misses or false positives. Review the safe preview before asking the assistant.
- DOM text from open shadow roots and same-origin frames can be scanned. Closed shadow roots and cross-origin frames the user has not granted are restricted by browser security.
- The visual scanner uses a local screenshot of the visible tab, so off-screen content is not scanned until it is visible. Browser restrictions or capture failures are shown in the panel. Screenshots and OCR output are not uploaded.
- Dynamic pages are rescanned after DOM, text, attribute, input, and selection changes with a short debounce. A page can still change between review and an action.
- Confirmed fill actions still target the demo's three application-answer fields. Generic page scanning and safe-context requests work without those demo controls; generic assistant-directed actions are not implemented.
- The controlled local demo backend defaults to `localhost:3000`. If changing that endpoint for deployment, update the endpoint constant and matching host permission together. The server-side API key, if configured, stays on the server.
- A page's own scripts and other extensions are outside this prototype's protection. Use fictional data in demos. Do not use this project as a substitute for a security review or a production privacy product.

## Tests

From `private-pilot-testing`, run:

```bash
npm run test:extension
npm run check:extension
npm test
```

The offline fixtures under `test-fixtures/` contain fake bank-dashboard, registration, and dynamic SPA content. They do not contact a website.
