# Contributing to the StellarPOS Backend

## Setup

```bash
git clone https://github.com/<you>/backend.git
cd backend
npm install
cp .env.example .env    # set JWT_SECRET
npm run db:seed
npm run dev
```

Node.js 22.13 or newer is required for the built-in `node:sqlite` module
(see `.nvmrc`).

## Already have a fork?

Every fork of this repository is listed in [CONTRIBUTORS.md](CONTRIBUTORS.md#forks).
Most were created before the current code landed and are many commits behind
`main`. Sync yours before you start, or you will be working on code that no
longer exists:

```bash
# GitHub CLI
gh repo sync <you>/<your-fork> --source StellarPOS-App/backend --branch main

# or plain git, from your clone
git remote add upstream https://github.com/StellarPOS-App/backend.git
git fetch upstream
git checkout main && git merge --ff-only upstream/main && git push
```

You can also click **Sync fork** on your fork's GitHub page. Once your first
pull request is merged, you move from the Forks list to the contributors table.

## Workflow

1. Open or claim an issue for anything beyond a typo.
2. Branch from `main`: `feat/...`, `fix/...`, `docs/...`, `test/...`.
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/),
   for example `feat(payments): ...` or `fix(products): ...`.
4. Run `npm run check` (lint, type-check, tests). CI also runs Prettier and a
   Docker build.
5. Open a pull request using the template, with `Closes #N`.

## Conventions

- **Layers.** Routes validate input and shape responses. Business rules live
  in `services/`. SQL lives in `models/`. Only `services/horizon.ts` talks to
  the Stellar network.
- **Validation.** Every request body goes through a Joi schema in
  `validation/` via `validateBody`. Unknown keys are stripped.
- **Errors.** Throw `AppError(message, status)`, or the `notFound`,
  `conflict` and `badRequest` helpers. Never send error responses by hand
  from deep code.
- **Money.** Integer cents for store amounts, `bigint` stroops for Stellar
  (`utils/money.ts`). Never use floats for money.
- **Multi-step writes** go through `withTransaction` so a failure rolls back.
- **Tests.** Every endpoint change needs a Supertest test. Mock the network
  at `@/services/horizon`, never at the SDK.
- **Secrets.** Never log tokens, passwords, or anything that looks like a key.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
