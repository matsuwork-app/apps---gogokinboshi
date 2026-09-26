This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Verification

Unit tests, database migration verification, and type checking:

```bash
npm test
npm run db:verify
npm run typecheck
```

Playwright starts the local development server by default and uses the
Supabase read-only connection from `.env.local`:

```bash
npm run test:e2e
```

To smoke-test a deployed environment without writing test data, provide its
URL. The optional manager password scenario authenticates successfully and
then submits an intentionally invalid, non-mutating member name:

```bash
PLAYWRIGHT_BASE_URL=https://example.vercel.app \
E2E_MANAGER_PASSWORD=your-manager-password \
npm run test:e2e
```

The E2E suite never creates or deletes production records. It covers public
rankings and event history, 3–4 team assignment, two-team match selection,
invalid-password rejection, and a non-mutating successful manager login.

Supabase migration, backup, and rollback procedures are documented in
[`supabase/README.md`](supabase/README.md).
