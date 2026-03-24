1. Create a Google Sheet.
2. Add a sheet tab named Responses.
3. In row 1, add these headers:
   Timestamp | Name | Email | Agency | Sex | Purpose
4. Open Extensions > Apps Script.
5. Replace the default code with Code.gs.
6. Paste your Google Sheet ID into spreadsheetId.
7. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone
8. Copy the deployed Web App URL.
9. In Netlify, set VITE_GAS_WEB_APP_URL to that URL.
