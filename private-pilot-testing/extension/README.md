# PrivatePilot extension

Phase 6 adds confirmed local actions. The extension sends only safe redacted context and the user's question to `/api/privatepilot/assist`; the server rejects obvious raw PII and uses local demo mode unless an LLM is configured through server environment variables. The assistant can suggest one supported field fill, but the extension executes it only after the user selects **Approve action** and confirms the browser dialog.

## Load locally

1. Run the demo website at `http://localhost:3000`.
2. Open `chrome://extensions` in Chrome or another Chromium browser.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select this `extension` folder.
6. Open the PrivatePilot demo website, then select the PrivatePilot toolbar button to open its side panel and grant the active-tab permission for that page.
7. Reload the dashboard after loading the extension. Confirm that the displayed name and account number become `PERSON_1` and `ACCOUNT_1`.
8. Select **Review Local Context**. Compare the local-only original preview with the safe redacted preview.
9. Select **Mark private** beside an application-answer field, then confirm it becomes `PRIVATE_1`.
10. Select **Unmark** to restore that field locally. Select **Clear** to remove the local review and mapping.
11. Visit `http://localhost:3000/visual-test.html`, select **Run Visual Scan**, and confirm the fictional image text is covered with `PERSON_1` and `ACCOUNT_1` highlights.
12. Verify the result reports local scan time and screenshot-memory use. The English Tesseract model is bundled with the extension, so no Chrome experimental flag or network access is required.
13. Select **Review Local Context**, ask “Help me answer why should we hire you?”, and verify that the displayed exact payload contains placeholders only.
14. Confirm the assistant suggests filling the application-answer field, then select **Approve action** and approve the browser dialog. Confirm that the field is filled locally.
15. Select **Reject action** on a later suggestion to leave the dashboard unchanged, then check the audit panel for the decision.
16. Ask “What is my name?” and confirm local demo mode does not know the real value.

PrivatePilot now requests `<all_urls>` so the local guard starts on normal `http` and `https` webpages. Chrome blocks extensions from browser-internal pages such as `chrome://` and extension pages.
