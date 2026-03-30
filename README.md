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
