# AirCalc Pro — Post Upload Test Checklist

## 1) Core startup
- Open the app and confirm it loads without a blank screen
- Open DevTools Console and confirm there are no blocking errors

## 2) Language
- Switch Arabic / English
- Check labels, placeholders, quotation labels, and project manager labels

## 3) Calculation
- Add a room
- Enter volume and people
- Run a calculation
- Confirm history and quotation update

## 4) Quote + project mode
- Add items to quotation
- Test Room mode
- Test Project mode
- Save a project
- Reload the page and reopen the project

## 5) Persistence
- Switch Basic / Advanced
- Refresh page and confirm calc mode persists
- Confirm current project persists
- Confirm theme persists

## 6) Reset
- Press Reset App
- Confirm history, quote settings, calc mode, project pointer, and plan state clear correctly

## 7) Output
- CSV export
- HTML invoice
- PDF export
- Tech report export

## 8) Final smoke check
- Hard refresh once after deployment
- Re-test the app from GitHub Pages URL
