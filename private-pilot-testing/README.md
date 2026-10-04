# PrivatePilot demo

PrivatePilot is a controlled Chrome/Chromium extension demonstration for SIH26171. After the user clicks the toolbar button on an ordinary HTTP or HTTPS webpage, it locally scans visible page text and form controls, replaces detected private values with placeholders, and shows the detected details in a local review with mark/unmark controls. The demo dashboard remains available, and the extension can also be tried on other sites after the user grants that origin access.

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
- Local detected-details list with mark/unmark controls
- Generic visible-text and form scanning, including open shadow roots, same-origin iframes, and dynamic pages
- Site access granted by the user for the current origin rather than permanent all-sites access
- Automatic review updates after page navigation and tab changes

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

The extension does not need the demo server, a database or an AI service.

1. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**.
2. Choose the [`extension`](extension) folder.
3. Open a normal HTTP or HTTPS webpage and click the PrivatePilot toolbar button. Grant access to this site when Chrome asks.
4. Select **Review local analysis**. The panel lists detected text and form values.
5. Use **Unmark** to restore a value or **Mark private** to hide it again. Password and OTP controls stay masked.
6. After updating the extension, reload it in Chrome, reload the webpage, and reopen the panel.

The current site's permission lets PrivatePilot reinject after navigation. A different site needs a separate grant. The panel refreshes for full navigation, same-tab URL changes, tab switches and late-loading content. Browser-protected pages and frames without permission remain inaccessible.

## Detection and limits

Heuristics cover labelled names and addresses, email, Indian phone numbers, PAN, Aadhaar, IFSC, labelled bank account numbers, validated payment cards, UPI IDs, PIN codes and dates of birth. Password, OTP and card security fields are masked without reading their values.

Detection can miss details or produce false positives. Open shadow roots and same-origin frames are scanned. Closed shadow roots and frames without permission remain restricted. The panel reviews detected details from the main page and same-origin frames. See [extension/README.md](extension/README.md).

Original-value mappings remain in extension memory. No page text or mappings are uploaded. A full page reload/navigation or closing the tab discards that memory.

## Current extension workflow

Sign-in fields keep their submitted values. PrivatePilot does not replace recognised authentication controls, including username, email-first and OTP login fields. Displayed account details after login are still scanned.

```text
Webpage selected through the toolbar
  -> Local detection
  -> Detected values replaced on the page
  -> Local list of detected details
  -> User can unmark or mark a detail again
```

The panel has no assistant, context-upload or field-fill action. Older visual source and bundled OCR assets remain in the repository but are not exposed in the panel. The backend's previous assistant endpoint remains separate from the extension and is not called by it.

## Demo

1. Open a page with fictional details, such as the protected demo dashboard.
2. Click PrivatePilot's toolbar button and grant access.
3. Review detected details and inspect the replacements on the page.
4. Unmark a detected value and confirm it returns on the page.
5. Mark it private again.
6. Navigate to another page on the granted site and confirm the panel updates.

PrivatePilot does not intercept or control another browser assistant. Another agent may already have read a value or obtain it from a source outside the modified DOM.

## Tests

Run the following from the project root:

```bash
npm run test:extension
npm run check:extension
npm test
```

The automated tests cover local capture, PII detection, detected-detail review, unmark persistence, reinjection, tab/page changes, stale-response handling, protected profile access and the separate legacy backend endpoint.

## Security limitations

- Detection is heuristic and covers the demo labels and common name, email, phone, account-number, address, password, and OTP formats. It is not a guarantee that every sensitive value on every website will be found.
- Visual detection runs locally and may miss low-quality, stylised, or obscured text.
- Chrome does not guarantee that a third-party extension executes before an external browser agent reads a page. This project demonstrates a controlled PrivatePilot workflow, not universal interception of closed AI products.
- Use fictional data only for demonstrations. Review the results carefully.
