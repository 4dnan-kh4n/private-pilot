# PrivatePilot browser extension

PrivatePilot checks webpage text locally and replaces detected private details on the page with labels. The side panel lists the detected details and lets you unmark a value or mark it private again. It does not call an AI service, send page text to a backend, or require the demo website to be running.

## Load or update

1. Open `chrome://extensions`, enable Developer mode and load this `extension` folder.
2. For an existing installation, click Reload on the PrivatePilot extension.
3. Reload the target webpage too. Close and reopen the PrivatePilot panel after updating.
4. On a normal HTTP or HTTPS webpage, click the PrivatePilot toolbar button.
5. Grant access to the current site when Chrome asks. This lets the extension resume after navigation on that site.
6. Select **Review local analysis**. The list also refreshes when the tab, page or detected content changes.
7. **Unmark** restores that detected value on the page. **Mark private** hides it again. Password and OTP controls remain masked and cannot be unmarked.

Only the current site origin is requested. A different site needs its own permission, granted through the toolbar button. The extension cannot access browser-internal pages, extension pages, the Chrome Web Store or other browser-protected pages.

## What is checked

Heuristic rules cover labelled names and addresses, email, Indian phone numbers, PAN, Aadhaar, IFSC, labelled 9–18 digit account numbers, validated payment card numbers, UPI IDs, PIN codes and dates of birth. The review includes detected ordinary page text as well as form fields. Values beneath table headings are matched to their own column.

Sign-in identity fields and controls in recognised authentication forms are not read or replaced. This preserves the credentials the website needs, including email-first and OTP login steps. Password, OTP and card security controls are never read. Their display is masked while preserving the page's underlying value. Other detected values can be replaced in displayed DOM text or non-authentication form controls.

## Local data and permissions

- `activeTab`: temporary access after the user selects the toolbar button.
- `scripting`: install the scanner in the selected page and accessible frames.
- `sidePanel`: show local analysis and mark/unmark controls.
- Optional HTTP/HTTPS host permissions: access to the particular origin the user grants.
- No mandatory backend host permission, assistant UI, network request helper or field-fill action.

Original values and replacement mappings stay in extension memory. They are not stored persistently, logged or uploaded. A full page reload/navigation or closing the tab discards them. Removed details disappear from the review when the page changes.

The older visual-scan source and bundled Tesseract assets remain in the folder for compatibility. Visual scanning is not exposed in the current panel.

## Limits

Detection can miss private details or flag an ordinary value. Review the page and use Unmark for false positives. Open shadow roots and same-origin frames are scanned. Closed shadow roots and frames without permission remain inaccessible. The list in the panel reviews the main page and accessible same-origin frames.

Replacing visible page text does not intercept or control another browser AI product. A page's scripts, previously captured context and other sources of data remain outside this extension's control. Chrome cannot guarantee this scanner runs before another agent reads a page. Use fictional data for demonstrations.

## Checks

From `private-pilot-testing`:

```bash
npm run test:extension
npm run check:extension
npm test
```

The automated checks cover capture, detected-detail review, persistent unmark choices, repeated injection, tab/page changes, stale responses, late-loading content and protected secret fields.
