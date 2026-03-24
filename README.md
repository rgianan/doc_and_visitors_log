# Netlify + Google Sheets Form

This project is a Vue 3 + Tailwind CSS web app that looks like a lightweight Google Form and saves responses into Google Sheets through a Google Apps Script web app.

## Fields
- Name
- Email
- Agency
- Sex
- Purpose

## Stack
- Vue 3
- Vite
- Tailwind CSS
- Netlify (hosting)
- Google Apps Script (backend endpoint)
- Google Sheets (database)

## Local setup
```bash
npm install
cp .env.example .env
npm run dev
```

Update `.env` with your deployed Apps Script Web App URL.

## Build
```bash
npm run build
```

## Deploy to Netlify
1. Push this project to GitHub.
2. In Netlify, import the Git repository.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variable:
   - `VITE_GAS_WEB_APP_URL` = your Google Apps Script Web App URL
6. Deploy.

Netlify automatically detects common framework settings, and build/publish settings can also be defined in `netlify.toml`. citeturn379468search12turn379468search18

## Google Sheets backend
Apps Script web apps can expose `doGet(e)` and `doPost(e)` endpoints, and `ContentService.createTextOutput()` can be used to return JSON responses. citeturn379468search1turn379468search7turn379468search13

Google Sheets can be updated programmatically from Apps Script through the Spreadsheet service. citeturn379468search4turn379468search10

## Tailwind setup
This project uses Tailwind with Vite via the official plugin approach. citeturn379468search2turn379468search11turn379468search14
