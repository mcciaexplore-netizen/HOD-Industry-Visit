# HOD Industry Visit (MCCIA)

HODs (Heads of Department) use this app to report an industry visit in under a minute: the company, who went along, photo proof with location and time, and the purpose of the visit. It opens from the MCCIA App Hub as a standalone app.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Neon Postgres + Drizzle ORM · Vercel Blob · Vercel

All commands below are for **Windows PowerShell** (VS Code terminal).

---

## 1. Local setup

```powershell
# Node 20+ required
node -v

npm install
Copy-Item .env.example .env.local
code .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Neon dashboard > your project > **Connection string** (pooled) |
| `BLOB_READ_WRITE_TOKEN` | Vercel > Storage > create a **Blob** store > `.env.local` tab |
| `SESSION_SECRET` | Any random string of 32+ characters (command below) |

Generate a session secret:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

### Database

```powershell
npm run db:migrate          # creates the tables (lib/db/migrations)
```

Edit `data/hods.csv` (columns `name,email,department,role`, where `role` is `hod` or `admin`; leave it blank for hod). **Change the sample admin row to a real admin email**, then:

```powershell
npm run seed                          # uses data/hods.csv
npm run seed -- C:\path\to\hods.csv   # or any other CSV
```

Running the seed again is safe. It updates existing people by email.

### Run

```powershell
npm run dev        # http://localhost:3000
```

On a laptop, `localhost` counts as a secure origin, so the camera and location work there.

---

## 2. Testing on a real phone (HTTPS required)

Browsers only allow the camera and location on HTTPS. Choose one option:

**Option A: Vercel preview (simplest).** Deploy (section 3) and open the preview URL on the phone.

**Option B: Tunnel to your laptop.**

```powershell
npm run dev
# in a second terminal:
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

Open the `https://….trycloudflare.com` URL on the phone.

**Option C: LAN with a self-signed certificate.**

```powershell
npm run dev:https     # https://<your-PC-IP>:3000, accept the certificate warning on the phone
```

Find your PC's IP with `ipconfig`. On some phones, the camera stays blocked behind an untrusted certificate. If that happens, use A or B.

### Phone test checklist

- [ ] Sign in with a seeded HOD email
- [ ] Take Photo opens the rear camera. Switch camera works.
- [ ] Deny location, then capture: a clear message and Retry appear, and the photo is not added
- [ ] Allow location, then capture: the photo shows the **Camera** badge with time and coordinates, and the stamp strip is on the image
- [ ] Upload Photo: multiple photos can be selected, each card has a date and time picker, and future times are rejected
- [ ] Remove a photo. The 11th photo is refused. Files over 10 MB are refused.
- [ ] Submitting with empty fields shows inline errors
- [ ] Submit, see the success screen, tap Report another visit
- [ ] My Visits lists the report. The detail page shows photos, a map link and members.
- [ ] Admin: filters, search, detail view and Export to Excel work, and the photo links in the export open after signing in

---

## 3. Deploy to Vercel

```powershell
npm install -g vercel
vercel login
vercel link                 # create or select the project
```

In the Vercel dashboard for the project:

1. **Storage > Connect Database > Neon** (or paste your own `DATABASE_URL` under Settings > Environment Variables).
2. **Storage > Create > Blob** and connect it to the project. This sets `BLOB_READ_WRITE_TOKEN`.
3. **Settings > Environment Variables:** add `SESSION_SECRET` for Production and Preview.

Then:

```powershell
vercel env pull .env.local  # optional: use the same env vars locally
npm run db:migrate          # run against the production DATABASE_URL
npm run seed
vercel --prod
```

Add the production URL to the App Hub card. Vercel serves HTTPS only, and the app sends HSTS and `Permissions-Policy: camera=(self), geolocation=(self)`.

---

## 4. How it works

### Screens

| Route | Who | What |
| --- | --- | --- |
| `/login` | everyone | Email sign-in |
| `/` | HOD, admin | Report a Visit form |
| `/visits`, `/visits/[id]` | HOD, admin | Your own reports, newest first |
| `/admin`, `/admin/visits/[id]` | admin | All reports: filters, search, detail, Excel export |
| `/admin/hods` | admin | Add, update, deactivate HODs, bulk CSV import |

### Photos

- **Take Photo** uses `getUserMedia` (rear camera by default). When the shutter is tapped, the app records the device time, requests a high-accuracy location, and burns a strip onto the image with the company, date and time (IST), latitude and longitude, and accuracy. A camera photo is never accepted without a location. If the browser has no `getUserMedia`, the phone's camera app is used instead (`capture="environment"`), and that photo is also located and stamped.
- **Upload Photo** accepts multiple files. Each photo gets a date and time picker (defaults to now). Adding a location is optional. EXIF data is ignored.
- Each image is resized in the browser to a long edge of at most 1600 px and saved as JPEG at quality 0.8. Photos upload one per request (to stay under Vercel's 4.5 MB body limit) to `visits/<hodId>/<uuid>.jpg` in Blob. When saving, the server only accepts Blob URLs under the signed-in HOD's own prefix.
- `visits.created_at` and `visit_photos.created_at` record **server time** for audit. `visit_photos.captured_at` holds device time (camera) or the time the user chose (upload).
- The Blob store is **private**. Photos are served only through `/photos/<id>` (`app/photos/[id]/route.ts`), which checks that the viewer is the reporting HOD or an admin. Excel photo links point there too, so opening one asks for sign-in.

### Auth and swapping in App Hub SSO

- `lib/auth/session.ts`: signs and verifies the session cookie (HS256 JWT holding only the HOD id). Runs on the edge, used by `proxy.ts`.
- `lib/auth/index.ts`: `getCurrentUser()`, `requireUser()`, `requireAdmin()`. **This is the only auth surface the app uses.** Role and active status are re-read from the database on every request, so deactivating someone takes effect immediately.
- `lib/auth/email-login.ts` + `app/login`: the email sign-in. **To move to App Hub SSO,** replace these two with an SSO callback that verifies the App Hub token, looks up the HOD by email, and calls `startSession(hod.id)` (or change `getCurrentUser` to read the App Hub token directly). Nothing else needs to change.

> **Security note:** email-only sign-in means anyone who knows a registered HOD's email can sign in as that HOD. This is acceptable for a pilot. Before wide rollout, switch to App Hub SSO or add an email one-time code.

### Theme

The brand colours are defined once in `app/globals.css` (`:root`). They were sampled from mcciapune.com and the MCCIA logo:

| Token | Hex | Source |
| --- | --- | --- |
| `--mccia-blue` (primary) | `#176dae` | logo blue (passes AA contrast on white) |
| `--mccia-blue-bright` | `#0082de` | site buttons |
| `--mccia-blue-dark` | `#003961` | site deep blue |
| `--mccia-navy` | `#263150` | site navy |
| `--mccia-green` | `#18ab56` | logo green |
| `--mccia-teal` | `#0f9b9b` | App Hub style accent |

Fonts: Outfit (body) and Bricolage Grotesque (headings), loaded with `next/font`.

### Limits (`lib/limits.ts`)

At most 10 photos per report · 10 MB per file before compression · company name up to 200 characters · purpose up to 2000 characters · up to 20 members.

### Scripts

```powershell
npm run dev | build | start | lint | typecheck
npm run db:generate   # after editing lib/db/schema.ts
npm run db:migrate
npm run db:studio
npm run seed
```
