# Web Environment

The web app is a TanStack Start frontend. It should not import backend internals at runtime; it talks to the API through `VITE_API_BASE_URL`.

## Required In Production

| Variable | Production value | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://api.oss.now` | Base URL for Better Auth, tRPC, session guards, and UploadThing. |

## Optional

| Variable | Local default | Purpose |
| --- | --- | --- |
| `VITE_PUBLIC_ENV` | Vite mode | Public environment label. |
| `VITE_DATABUDDY_CLIENT_ID` | unset | Enables Databuddy analytics when configured. |

## Local Development

Use the API on `localhost:3001` and the frontend on `localhost:3000`:

```sh
VITE_API_BASE_URL=http://localhost:3001
bun run dev
```

Only variables prefixed with `VITE_` are exposed to browser code. Never place Better Auth, OAuth, Resend, UploadThing, GitHub, OpenAI, or database secrets in the web repo.

## Checks

Run before deploy:

```sh
bun run typecheck
bun run lint
bun run smoke
bun run build
```
