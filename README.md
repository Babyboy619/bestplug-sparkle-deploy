# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Database migrations

Database changes are stored in `drizzle/migrations`. Configure
`LOVABLE_DB_MIGRATION_URL` for the intended database, then apply pending
migrations with:

```sh
npx drizzle-kit migrate
```

Review and back up the target database before applying migrations to production.

The administrator category and notification features are added by
`0005_admin_categories_notifications.sql`. Broadcasts are stored once and served
from a persistent in-app feed with per-user read receipts; sending does not
depend on an external email or push-notification provider. Category deletion is
archival and requires reassignment when products are linked to that category.
