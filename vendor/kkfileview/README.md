# kkFileView Vendor Layout

This repository integrates `kkFileView` as a sidecar service and expects the official Linux distribution to be unpacked at:

`vendor/kkfileview/current`

The `current` directory should contain the standard distribution layout with at least:

- `bin/startup.sh`
- `bin/shutdown.sh`
- `config/application.properties`
- `log/`
- `kkFileView-4.4.0.jar`

Why the package is not checked into Git:

- The upstream GitHub release currently exposes source archives publicly, but the ready-to-run Linux distribution package is distributed through the maintainer community instead of GitHub release assets.
- The project scripts in [`scripts/linux`](../../scripts/linux) are already wired to this expected layout, so once the package is placed under `vendor/kkfileview/current`, the integrated startup flow works without extra project changes.

Recommended placement flow:

1. Download the official Linux release package for `kkFileView 4.4.0`.
2. Unpack it into `vendor/kkfileview/current`.
3. Run `scripts/linux/start-stack.sh`.
