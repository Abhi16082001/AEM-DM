# Personal Bill Creator — login starter

This project contains a plain HTML/CSS/JavaScript login page for GitHub Pages and a Google Apps Script login endpoint.

## Files

- `index.html` — login form
- `css/style.css` — styling
- `js/config.js` — Apps Script deployment URL
- `js/login.js` — submits credentials and stores a successful session token in `sessionStorage`
- `Code.gs` — Apps Script endpoint

## 1. Create the Google Sheet

Create a private Google spreadsheet. Add a sheet named `Users` with these exact headers in row 1:

`Username | Salt | PasswordHash | Active`

Do not make the spreadsheet public.

## 2. Configure Apps Script

1. Open [script.google.com](https://script.google.com/) and create a project.
2. Paste the contents of `Code.gs` into the editor.
3. Open **Project Settings → Script Properties** and add:
   - Property: `SPREADSHEET_ID`
   - Value: the ID from the spreadsheet URL (the text between `/d/` and `/edit`)
4. Save the project.
5. For initial setup only, replace the sample username and password inside `setupInitialUserExample_()` with your own unique credentials. Run that function manually once and authorize it. Then remove the real password from the code and save. Never commit real credentials to GitHub.
6. Deploy → **New deployment** → select **Web app**. Choose **Execute as: Me**. Choose the access setting that permits your intended users to reach the endpoint; broad access means the endpoint is publicly reachable, so strong credentials and server-side checks are essential.
7. Copy the deployed URL ending in `/exec`.

## 3. Configure the frontend

Open `js/config.js` and replace `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with the deployed `/exec` URL.

Push the files (except any file containing real credentials) to a GitHub repository and enable GitHub Pages in the repository settings.

## 4. Test the login

Open the GitHub Pages URL, enter the username/password created in the setup step, and submit. On success, the browser stores the temporary token in `sessionStorage` and redirects to `welcome.html`.

This starter intentionally does not include `welcome.html` yet. Until the next step is implemented, create a temporary `welcome.html` in the repository or change the redirect in `js/login.js` to a page you already have.

## Important limitations before using this for real bills

- **CORS:** Apps Script web apps may redirect responses, and cross-origin fetch behavior can vary. The browser must be able to read the JSON response from your GitHub Pages origin. If the browser reports a CORS error, do not work around it by putting the password in a URL or using JSONP. The simplest reliable alternative is to serve the login HTML from Apps Script itself, or use a backend that supports CORS explicitly.
- **Password hashing:** The included SHA-256 + salt helper is a simple starter, not modern password storage. Use a vetted PBKDF2 implementation for stronger password hashing and a long, unique password. Do not reuse your Google account password.
- **Session storage:** The token is temporary in the browser, but the server must validate it for every protected operation. `sessionStorage` is not an authorization boundary.
- **Token cache:** Apps Script CacheService is temporary and may evict entries early. Treat a missing session as expired and require login again.
- **No bill API yet:** This version implements login only. Do not add `createBill` until it validates the token server-side before writing to the spreadsheet.
- **Public static files:** GitHub Pages cannot hide HTML/JS files. Authorization must be enforced by Apps Script on every sensitive operation.
