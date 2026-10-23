# Security Policy

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/StellarPOS-App/backend/security/advisories/new).
Please do **not** open a public issue for security problems.

Include the affected endpoint or module, the impact, and steps to reproduce.
A failing Jest test is ideal. We aim to acknowledge reports within 3 business
days and will agree a disclosure date with you.

## Scope

Especially interesting:

- Marking a sale paid, or a Stellar request settled, without a matching
  on-chain payment
- Reusing one on-chain payment for more than one sale
- Authentication or role bypass (cashier performing manager or admin actions)
- Stock or totals manipulation through the sale endpoints
- Injection through search or filter parameters

Out of scope: missing security headers on non-production setups, rate-limit
tuning, and vulnerabilities in dependencies that have no demonstrated impact
here (report those upstream; Dependabot tracks them).

## Design commitments

- The backend never receives, stores or logs a Stellar secret key. It only
  watches the merchant's public key.
- Passwords are hashed with bcrypt. Login errors do not reveal whether an
  email exists.
- `JWT_SECRET` has no default. The server refuses to start without one, and
  in production requires at least 32 characters.
- All SQL uses bound parameters. User search terms are escaped for `LIKE`.

## Supported versions

Only the latest `main` receives security fixes.
