# PrivatePilot demo

PrivatePilot is a controlled Chrome/Chromium extension demonstration for SIH26171. It locally detects visible private values on the signed-in demo dashboard, replaces them with placeholders, and sends only the safe context to its own assistant.

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

1. Start the website with `npm start` and open `http://localhost:3000`.
2. Open `chrome://extensions`, enable **Developer mode**, and select **Load unpacked**.
3. Choose the [`extension`](extension) folder.
4. Open the local dashboard, select the PrivatePilot toolbar button, and reload the page once.
5. The extension runs its local guard on the approved demo hosts. Open the side panel to review its status.

The manifest requests Chrome's `<all_urls>` permission so that its local guard starts on normal `http` and `https` webpages. Chrome shows a broad-site-access warning for this permission. Browser-internal pages such as `chrome://`, extension pages, and some protected browser pages remain unavailable by Chrome design.

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
