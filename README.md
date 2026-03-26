# Netlify + Google Sheets Document Intake Portal

This version incorporates the document-intake workflow discussed earlier:
- submissions are screened at intake
- incomplete submissions are **not accepted for processing**
- every screened submission is still **logged** with a status and deficiency reason
- staff get an audit trail instead of informal verbal disputes

## What it does

### Public side
- document intake form
- required metadata fields
- intake checklist
- optional anti-bot honeypot
- minimum-fill-time check
- duplicate / burst submission blocking
- file upload to Google Drive
- immediate intake result message

### Intake decision logic
A submission is marked **ACCEPTED** only when all of these are present:
- signed request checked
- valid ID checked
- supporting documents checked
- file attachment uploaded

Otherwise it is marked **REJECTED_INTAKE** and logged with a deficiency reason.

### Admin side
- admin key gate
- dashboard cards
- intake audit table
- accepted vs rejected counts
- deficiency reason visibility
- CSV export

## Project structure
- `src/App.vue` — intake UI + admin dashboard
- `google-apps-script/Code.gs` — Apps Script API, Sheets logging, Drive upload, intake screening

## Local setup
```bash
npm install
cp .env.example .env
npm run dev
```

Set these in `.env`:
- `VITE_GAS_WEB_APP_URL`
- `VITE_ADMIN_KEY`

## Google Apps Script setup

1. Create a Google Sheet.
2. Create a Google Drive folder for uploads.
3. Open Apps Script and paste `google-apps-script/Code.gs`.
4. In Apps Script, set **Script Properties**:
   - `SPREADSHEET_ID` = your Google Sheet ID
   - `RESPONSES_SHEET_NAME` = `Responses`
   - `UPLOAD_FOLDER_ID` = your Google Drive folder ID
   - `ADMIN_KEY` = your admin password/key
   - `MAX_FILE_SIZE_BYTES` = `4194304` (optional)
   - `ALLOWED_FILE_TYPES` = `application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document` (optional)
5. Run `setupProject_()` once from Apps Script.
6. Deploy the script as a **Web app**.
7. Put the web app URL into `VITE_GAS_WEB_APP_URL`.

## Sheet columns
The backend creates these columns automatically:
- Timestamp
- Intake_ID
- Status
- Intake_Result
- Deficiency_Reason
- Document_Title
- Document_Type
- Name
- Email
- Agency
- Sex
- Purpose
- Signed_Request
- Valid_ID
- Supporting_Docs
- File_Name
- File_URL
- User_Agent
- Review_Note

## Security reality check
This is stronger than the generic starter, but not bulletproof.

Still weak:
- admin key is still a shared secret
- frontend config can still be exposed to someone with app access
- upload flow does not scan files for malware

Next upgrades worth doing:
- Turnstile or reCAPTCHA
- real admin auth
- audit actions for staff review notes
- stricter server-side requirement rules per document type
- file malware scanning and retention rules
