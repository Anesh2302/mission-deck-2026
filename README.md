# Reverse Hackathon 2026 — Mission Deck

Registration site for the Reverse Hackathon 2026, run by **The Whitehatians**, Department of
Cyber Security, SRM Valliammai Engineering College. A three-hour defensive sprint: participants receive an
already-built, deliberately vulnerable system and must find, patch and defend the fixes.

**Live site:** <https://mission-deck-2026.vercel.app/>

## What is in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The whole public site — markup, CSS and JS in one file. This is what visitors get. |
| `admin.html` | Organiser dashboard. Asks for `ADMIN_KEY`, shows registration totals and Excel download. |
| `hero-bg.jpg`, `superman-hero.jpg`, `about-bg.jpg`, `standards-bg.jpg`, `dc-contact-art.jpg`, `dc-contact-clear.jpg` / `.webp` / `.avif`, `srm-valliammai-logo.jpg`, `assets/superman-hero.png` / `.webp` / `.avif` | Section backgrounds and art. Modern browsers use the smaller AVIF/WebP variants; original files remain as fallbacks. |
| `assets/villains/` | The 15 gallery cards, downloaded from the old CDN so the site no longer depends on a third-party host. |
| `og-deck.png` | Open Graph preview image. |
| `api/` | Vercel serverless functions (Node). Registration storage + organiser API. |
| `scripts/check-site.mjs` | Pre-deploy check. Run it before every deploy. |
| `dev-host.cjs` | Local-only helper that serves the static site and runs `api/` without Vercel. |
| `src/`, `next.config.mjs`, `tailwind.config.ts` | An older Next.js draft with a different theme. **Not deployed** — see "Legacy files" below. |

The public site is a static HTML file plus serverless functions. There is no build step for the
front end, and no framework.

## Event facts

- **Date:** Tuesday, 13 October 2026, 09:00 IST (gates 08:00, ledger closes 07:00)
- **Format:** Solo only; every participant registers individually (no teams)
- **Eligibility:** DEP-CYS students, years I–III
- **Entry fee:** None. Registration is free; no payment or receipt is required.

The date lives in six places inside `index.html` — meta description, the `content:` string in
`.landing-art-frame::after`, the hero date line, the "ENTRY STATUS" badge, the contact block, and
`EVENT_TIME` for the countdown. Change all six together.

## Tech

- Static HTML/CSS/vanilla JS, jQuery only for the small chat widget
- Vercel serverless functions (Node 18+, CommonJS)
- Supabase Postgres through its server-only REST API
- ExcelJS for the `.xlsx` export
- No bundler, no transpiler, no framework runtime

## Environment variables

Set these in **Vercel → Settings → Environment Variables** (and in `.env.local` for local work).
See `.env.example`. Never commit real values.

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT` | Gmail SMTP (`smtp.gmail.com`, `465`) |
| `SMTP_USER`, `SMTP_PASS` | Mailbox + **App Password** (see below) |
| `MAIL_FROM` | Optional display sender. Defaults to `SMTP_USER` |
| `MAIL_NOTIFY_TO` | Optional. Comma-separated. CC/BCC yourself on every confirmation |
| `SUPABASE_URL` | Supabase project URL, such as `https://your-project.supabase.co` |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key; never expose it in browser code or GitHub |
| `ADMIN_KEY` | Long random string that unlocks `/admin.html` and every `/api/admin/*` route |

Generate a key with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

> **Gmail needs an App Password, not your account password.** If 2-Step Verification is on (and it
> should be), the real password is rejected by `smtp.gmail.com`. Go to
> <https://myaccount.google.com/apppasswords>, generate a 16-character App Password, and paste that
> into `SMTP_PASS`. Port 465 with `secure: true` is already handled.

Confirmation mail is sent **after** the registration is committed to Supabase and the response is
built, so an SMTP outage can never lose an entry. If mail fails the registration still succeeds and
the response reports `"emailSent": false`.

### Creating the Supabase project

1. Create a project at <https://supabase.com/>.
2. In **SQL Editor**, run the `registrations` table SQL supplied for this repository.
3. Keep Row Level Security enabled and revoke public table access.
4. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` only in Vercel Environment Variables.
5. Never commit the secret key or place it in browser JavaScript.

The API talks to Supabase only from Vercel server functions. The browser never receives the secret key.

## Registration (free)

Registration is free; no UPI payment, transaction ID, receipt, or proof is required. The server-side API
validation layer is the source of truth, and the page mirrors field errors onto the matching input.

Registration is solo only. The form collects the primary participant's name, email, phone, year,
department, gender and register number, one of 15 domains, how the participant heard about the event,
and agreement to the rules.

### API

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/register` | POST | none | Store one free registration. `201`, or `400` with `fieldErrors`, `409` on duplicate email, `403` after the deadline, `503` if Supabase is unreachable. |
| `/api/admin/registrations` | GET | `x-admin-key` | Registration details and registration/participant totals; legacy payment fields are excluded. |
| `/api/admin/export` | GET | `x-admin-key` | Streams a styled `.xlsx`. |

The admin key is compared with `crypto.timingSafeEqual`, so it cannot be probed byte by byte.

## Scoring

- `/admin.html` is the organiser control room. It lists participants, domain, problem statement, solution and provides a 0–30 mark input per registration.
- `/scoresheet.html` is a public, read-only leaderboard sorted by mark from highest to lowest; marks are entered only in the protected admin panel.

## Organiser dashboard

Open `/admin.html`, paste the `ADMIN_KEY`, and the dashboard shows registrations and participants
totals. You can filter the table and download a workbook with three sheets:

- **Participants** — one row per human. This is what the check-in desk wants.
- **Registrations** — one row per entry.
- **Summary** — event and registration totals; no fee reconciliation is included.

The key is held in `sessionStorage`, so it disappears when the tab closes.

For direct database inspection, open the Supabase dashboard → **Table Editor** → `registrations`.
The website admin key and Supabase secret key are separate; keep `SUPABASE_SECRET_KEY` private.

## Local development

There is nothing to build. To browse the site:

```bash
python -m http.server 8080     # or any static server
```

The API needs Node, so use the bundled helper or `vercel dev`:

```bash
npm install
# terminal 1 - static site + api/ on http://localhost:3100
set SUPABASE_URL=...&& set SUPABASE_SECRET_KEY=...&& set ADMIN_KEY=...&& node dev-host.cjs
# or, with the Vercel CLI (closest to production):
npx vercel dev
```

`vercel dev` is the better option because it runs the functions exactly as Vercel will.

## Deploy

`vercel.json` pins `framework: null` so Vercel serves `index.html` as a static file and does **not**
try to build the leftover Next.js app. Keep the project's Framework Preset on **Other**.

1. Push the repo.
2. Vercel → **New Project** → import → preset **Other**.
3. Add `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `ADMIN_KEY` under **Environment Variables**.
4. Deploy. `/`, `/admin.html` and `/api/*` all work immediately.

## Before you go live

1. **Confirm the free-entry policy** remains accurate in the registration form, confirmation email,
   and event announcement; do not add UPI, transaction IDs, payment screenshots, or proof uploads.
2. **Confirm the date** in all six places listed above.
3. **Set `ADMIN_KEY`** to a real secret. Do not reuse the local value.
4. **Contact email.** `CONTACT_EMAIL` in `index.html` is still
   `registration@whitehatians.in`. The confirmation mailto button uses it. Change it to the
   organiser mailbox (`SMTP_USER`) so replies land in the same inbox.
5. Proofread the domain list and schedule against your announcement.

## Deploy checklist

```bash
npm install
npm run check        # assets, inline JS, tags, ids, dates, branding, secrets
```

`npm run check` exits non-zero on any problem and is the fastest way to catch a missing image or a
leftover reference before you push.

## Legacy files

`src/`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json` and
`future-of-creative-ai-summit.html` are from an earlier Next.js draft with a different theme. The
deployed site does not use them and `vercel.json` prevents Vercel from building them. Delete them
once you are comfortable — but note `npm run dev` currently starts that old app, not this site.
