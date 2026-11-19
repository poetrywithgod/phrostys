# Phrostys storefront

The customer-facing website (Vite, React, Tailwind). It talks to the same Supabase project as `apps/admin`.

```
cp .env.example .env.local   # same two values as apps/admin
pnpm dev                     # http://localhost:5174
```

Shop name, phone, address and hours live in `src/config.ts`.
