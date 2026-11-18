# NCL 60 & 90 Days Cases — Krishna District Police

Two parts:

- `google-apps-script/Code.gs` — goes into Google Apps Script (Krishna district Google account). **Do not upload it to GitHub.**
- `github-site/` — upload everything inside this folder to the GitHub repository.

## Step 1 — Google Apps Script (Krishna mail id)

1. Sign in to Google with the **Krishna district mail id** → open https://script.google.com → **New project**.
2. Delete the sample code, paste all of `Code.gs`, and save (name it e.g. `Krishna NCL 60-90`).
3. Choose the function **setup** at the top → **Run** → allow access when Google asks.
   (This creates the Drive folder "NCL 60-90 Days Data - Krishna" where the uploads are kept.)
4. **Deploy → New deployment → Web app**  
   Execute as: **Me** · Who has access: **Anyone** → **Deploy**.
5. Copy the **Web app URL** (ends with `/exec`).

## Step 2 — GitHub site

1. Open `github-site/assets/config.js` in Notepad and paste the URL:
   `apiUrl: "https://script.google.com/macros/s/....../exec",` → Save.
2. Create a new repository (e.g. `krishnapolicencl.github.io` under the Krishna GitHub account, or any name)
   and upload everything inside `github-site/` (`index.html`, `assets`, `vendor`, `.nojekyll`).
3. Repository → **Settings → Pages** → Deploy from a branch → `main`, `/ (root)` → Save.

## Logins (same procedure as Chittoor)

| User | Password |
|---|---|
| admin | `Krishna@2026$` — user name + password only |
| bhaskar, rambabu, rajitha, ravichandran, bapuji, venugopal, sivakumar, thejovathi, siraj, other | `Kri@2026#` — must choose the 60 DAYS, 90 DAYS and CCDASHBOARD files to log in |

To change names or passwords, edit the `USERS` list at the top of Code.gs → Save →
**Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy** (the URL stays the same).
After 5 wrong passwords a user name is blocked for 10 minutes.

## Settings (`github-site/assets/config.js`)

- `subDivisions` — Krishna sub-divisions and stations (AVG, GDV, GVM, MTM, OTHERS — 34 stations).
  Station names must match the POLICE STATION column of the 60/90 DAYS files exactly; any station not in
  the list is reported when the file is chosen.
- `abstractPageBreakAfter` — the printed abstract breaks after the Gudivada SD.
- `excludeStations` — stations to drop while importing (empty for Krishna).
- `unitName`, `appTitle`, `fromDate`, `credit` — headings.
