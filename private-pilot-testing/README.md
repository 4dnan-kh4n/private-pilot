# PrivatePilot demo

PrivatePilot is a controlled Chrome/Chromium extension demonstration for SIH26171. After the user clicks the toolbar button on an ordinary HTTP or HTTPS webpage, it locally scans visible page text and form controls, replaces detected private values with placeholders, and sends only reviewed safe context to its own assistant. The demo dashboard remains available, and the extension can also be tried on other sites after the user grants that origin access.

It does not claim to intercept, alter, or control closed browser assistants such as Claude in Chrome, Comet, or ChatGPT. A normal chatbot also cannot obtain private data merely because it receives a URL.

## Features

- Registration and login
- Password hashing with bcrypt
- MongoDB-backed server sessions
- HTTP-only authentication cookie (`Secure` in production)
- Protected `GET /api/profile`
- Dynamically loaded profile dashboard
- Three application questions stored with the signed-in profile
- No public sharing links or token endpoints
- PrivatePilot controlled assistant that receives redacted context only
- Generic visible-text and form scanning, including open shadow roots, same-origin iframes, and dynamic pages
- Site access granted by the user for the current origin rather than permanent all-sites access
- Optional local visual scan for fictional text rendered in images
- AI action suggestions that require the user's explicit approval before a field is filled

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env`.
3. Add your MongoDB Atlas connection string and a long random session secret.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Environment variables

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/privatepilot?retryWrites=true&w=majority
SESSION_SECRET=replace-with-a-long-random-secret
NODE_ENV=development
PRIVATEPILOT_LLM_URL=
PRIVATEPILOT_LLM_API_KEY=
PRIVATEPILOT_LLM_MODEL=
```

Leave the three `PRIVATEPILOT_LLM_*` variables empty to use local demo mode. To use a cloud provider, configure an OpenAI-compatible chat endpoint, its server-side API key, and model. The extension never receives that key.

For Vercel, add `MONGODB_URI`, `SESSION_SECRET`, and `NODE_ENV=production` in the project environment settings.

## Load the extension

1. Start the controlled assistant with `npm start` from this folder. The profile demo uses MongoDB; the assistant route can run in local demo mode without it.
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**.
3. Choose the [`extension`](extension) folder.
4. Open an ordinary HTTP or HTTPS webpage and click the PrivatePilot toolbar button. Grant current-site access when Chrome asks. PrivatePilot injects locally and opens the side panel.
5. Choose **Review Local Context** to inspect the original local preview and safe redacted preview. The current-origin permission lets PrivatePilot reinject after that site's navigation. Revoke it in Chrome extension settings when finished.

PrivatePilot uses `activeTab` and `scripting` to inject after a toolbar click. It requests optional access to the current site origin so it can resume after navigation, and a narrow host permission for the default assistant at `http://localhost:3000`. Cross-origin iframe access requires permission for that frame's origin; same-origin frames are scanned with the page. Browser-internal pages such as `chrome://`, extension pages, and the Chrome Web Store remain unavailable by Chrome design.

## Supported detection and limits

Heuristics cover names and addresses when labelled, email, Indian phone, PAN, Aadhaar, IFSC, labelled bank account numbers (9–18 digits), Luhn-checked payment cards, UPI IDs, labelled PIN codes, dates of birth, and password, OTP, and card security fields. Password fields and fields marked with password, OTP, or card autocomplete are never read into extension messages and are visually masked. Review the side-panel safe preview before sending context.

This prototype cannot guarantee complete detection. Closed shadow roots, ungranted cross-origin frames, inaccessible browser pages, off-screen images, OCR errors, unusual labels, and unknown formats can be missed. Visual OCR uses a local screenshot of the visible tab and bundled Tesseract assets; screenshots and OCR text are not uploaded. The assistant endpoint defaults to `http://localhost:3000/api/privatepilot/assist`; update `ASSISTANT_ENDPOINT` in `extension/sidepanel.js` and the matching manifest host permission together when deploying it elsewhere. See [`extension/README.md`](extension/README.md) for the permission details and limitations.

## Architecture

```text
Signed-in demo page
  -> PrivatePilot content script: local DOM and optional visual scan
  -> Local placeholder map held in extension memory
  -> Safe redacted context + user question
  -> /api/privatepilot/assist
  -> Controlled assistant response + optional structured action suggestion
  -> User approval
  -> Local field fill using the extension-only placeholder map
```

The backend accepts only safe context, rejects obvious raw PII, and does not log webpage context, screenshots, cookies, placeholder maps, or secrets. API credentials stay in server environment variables.

## Teacher demo script

1. Register and sign in.
2. Show that the private dashboard dynamically loads dummy profile data from the protected profile API.
3. Open PrivatePilot and select **Review Local Context**. Show the local preview beside the safe preview where real values appear as `PERSON_1` and `ACCOUNT_1`.
4. Optionally open `/visual-test.html`, select **Run Visual Scan**, and show fictional values detected inside the image without uploading a screenshot.
5. Ask: “Help me answer why should we hire you?” Show the exact safe payload and the assistant's structured fill suggestion.
6. Select **Approve action**. Confirm the application-answer field is filled only after the confirmation dialog.
7. Ask: “What is my name?” Confirm that local demo mode does not know the real value.
8. Show the audit panel: scan, detections, redaction, safe payload, and action approval.

PrivatePilot is a controlled assistant demonstration. It does not claim to intercept or modify closed browser agents such as Claude, Comet, or ChatGPT.

## Tests

Run the following from the project root:

```bash
npm run test:extension
npm run check:extension
npm test
```

The automated tests cover extension capture, PII detection, visual candidate matching, safe payload generation, structured action confirmation, protected profile access, and the backend's raw-PII rejection.

## Security limitations

- Detection is heuristic and covers the demo labels and common name, email, phone, account-number, address, password, and OTP formats. It is not a guarantee that every sensitive value on every website will be found.
- Visual detection runs locally and may miss low-quality, stylised, or obscured text.
- Chrome does not guarantee that a third-party extension executes before an external browser agent reads a page. This project demonstrates a controlled PrivatePilot workflow, not universal interception of closed AI products.
- Use fictional data only for demonstrations. This is a prototype, not a production privacy product.
