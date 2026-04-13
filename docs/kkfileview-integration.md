# kkFileView Integration

## What was wired into the project

- Backend proof responses now include `previewUrl` and `downloadUrl`.
- `kkFileView` preview URLs are generated on the server.
- A dedicated internal source endpoint is available at `/api/internal/proofs/:proofId/source`.
- Frontend proof lists now default to preview and expose download separately.
- Linux helper scripts are available under `scripts/linux`.

## Required environment

Add these values to the server environment:

```env
APP_BASE_URL=http://127.0.0.1:3000
WEB_BASE_URL=http://127.0.0.1:5173
KKFILEVIEW_PUBLIC_BASE_URL=http://127.0.0.1:3000/preview
KKFILEVIEW_SOURCE_BASE_URL=http://127.0.0.1:3000
KKFILEVIEW_PREVIEW_TOKEN=change-this-preview-token
```

## Linux startup flow

1. Build the NestJS server so `apps/server/dist/src/main.js` exists.
2. Install `JDK` and `LibreOffice` on the host.
3. Unpack the official `kkFileView` Linux package into `vendor/kkfileview/current`.
4. Start the stack:

```bash
./scripts/linux/start-stack.sh
```

5. Stop the stack:

```bash
./scripts/linux/stop-stack.sh
```

## Nginx

Use [`deploy/nginx/okr-preview.conf.example`](../deploy/nginx/okr-preview.conf.example) as the reverse-proxy baseline so the browser reaches the preview service through `/preview/`.
