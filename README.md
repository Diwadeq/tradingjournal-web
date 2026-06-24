# PHU "DUET" — Sebastian Zawada

Business website built with **Next.js 15**, **React 19**, **Tailwind CSS 4**, and **TypeScript**.

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000
```

## Project structure

```
app/                  → Next.js pages & layout
components/
  layout/             → Header, Footer (shared across pages)
  sections/           → Hero, About, Services, WhyUs, Contact
lib/
  content.ts          → ALL business text, contact info, services
public/images/        → Static assets (logo, photos)
```

## How to update content

**All text lives in one file: `lib/content.ts`.**

Change the company name, phone number, services, or any other text there.
Components read from that file — no need to touch JSX.

## Build & deploy

```bash
npm run build         # Generates static site in /out
```

The `output: "export"` setting in `next.config.ts` produces a fully static site
you can host on GitHub Pages, Netlify, Vercel, or any web server.
