# Project structure

## Directory layout

```
powerbi-embedded-portal/
├── docs/                    # All documentation (md, design, SOW-related)
│   ├── README.md            # Index of docs
│   ├── TODO.md              # SOW checklist and build tracker
│   ├── DESIGN-REFERENCE.md  # Brand and copy reference
│   └── PROJECT-STRUCTURE.md # This file
├── public/                  # Static assets (favicon, images)
│   └── .gitkeep             # See below
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/
│   ├── config/              # Env-based config (no hardcoding)
│   ├── lib/
│   ├── types/
│   └── hooks/
├── .env.example
├── .env                     # Gitignored; your secrets (Next.js + Prisma read this)
└── README.md                # Main project README (root)
```

## Why `public/.gitkeep`?

**Git does not track empty directories.** If `public/` had no files, it would not be committed and could be missing after a clone.

- **`.gitkeep`** is a small placeholder file (often empty or with a one-line comment) that lives inside `public/`.
- Because of it, Git tracks the `public/` folder. You can add real assets later (e.g. `favicon.ico`, `images/`) and remove `.gitkeep` if you like, or leave it.
- This is a common convention in many projects.

You can delete `public/.gitkeep` once you add any real file under `public/` (e.g. a favicon).
