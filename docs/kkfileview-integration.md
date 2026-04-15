# kkFileView Integration

## What was wired into the project

- Backend proof responses now include `previewUrl` and `downloadUrl`.
- `kkFileView` preview URLs are generated on the server.
- A dedicated internal source endpoint is available at `/api/internal/proofs/:proofId/source`.
- Frontend proof lists now default to preview and expose download separately.
- Linux helper scripts are available under `scripts/linux`.
- The project can stage a source-built `kkFileView` runtime under `vendor/kkfileview/current` and start it together with the main app.

## Required environment

Add these values to the server environment:

```env
APP_BASE_URL=http://127.0.0.1:3000
WEB_BASE_URL=http://127.0.0.1:5173
KKFILEVIEW_PUBLIC_BASE_URL=http://127.0.0.1:3000/preview
KKFILEVIEW_SOURCE_BASE_URL=http://127.0.0.1:3000
KKFILEVIEW_PREVIEW_TOKEN=change-this-preview-token
```

## Office To PDF Preview

For `docx/pptx` preview, the project now tries to generate a PDF inside the Node service before falling back to `kkFileView`.

- On Windows development machines, the service can use local Microsoft Word / PowerPoint COM automation.
- On Linux servers, the service should use local `LibreOffice` through `soffice`.

Recommended Linux packages:

```bash
sudo apt-get update
sudo apt-get install -y libreoffice libreoffice-writer libreoffice-impress fontconfig fonts-noto-cjk
```

Optional explicit path:

```env
LIBREOFFICE_EXECUTABLE_PATH=/usr/bin/soffice
PROOF_PDF_PREVIEW_TIMEOUT_MS=120000
```

After deployment, verify the preview conversion runtime with:

```bash
curl http://127.0.0.1:3000/api/health/preview
```

The response should show:

- `"preferredEngine": "libreoffice"` on Linux
- `"officeToPdfAvailable": true`
- a valid `libreOffice.executablePath`

## Source-build Flow

1. Prepare server dependencies on Linux:

```bash
sudo apt-get update
sudo apt-get install -y openjdk-17-jre-headless maven libreoffice fontconfig fonts-noto-cjk libxext6
```

2. Download or clone the upstream `kkFileView` source code from GitHub to any local path on the server.

3. Build and stage `kkFileView` into this project:

```bash
./scripts/linux/build-kkfileview-from-source.sh /path/to/kkFileView
```

4. Build the NestJS server so `apps/server/dist/src/main.js` exists.

5. Start the full stack from this project:

```bash
./scripts/linux/start-stack.sh
```

6. Stop the full stack:

```bash
./scripts/linux/stop-stack.sh
```

After the build step, the project-managed runtime should exist at:

- `vendor/kkfileview/current/kkFileView.jar`
- `vendor/kkfileview/current/config/application.properties`
- `vendor/kkfileview/current/log/`

## Service Unit

Use [`deploy/systemd/okr-stack.service.example`](../deploy/systemd/okr-stack.service.example) as the baseline systemd unit when you want the project to start both the Node server and the staged `kkFileView` runtime together.

The optional environment file example is at [`deploy/systemd/okr-stack.env.example`](../deploy/systemd/okr-stack.env.example).

## Nginx

Use [`deploy/nginx/okr-preview.conf.example`](../deploy/nginx/okr-preview.conf.example) as the reverse-proxy baseline so the browser reaches the preview service through `/preview/`.
