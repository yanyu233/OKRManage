# kkFileView Vendor Layout

This repository integrates `kkFileView` into the project startup flow and expects the runnable preview service to live under:

`vendor/kkfileview/current`

Recommended layout for the project-managed runtime:

- `kkFileView.jar`
- `config/application.properties`
- `bin/*.sh` (optional helper scripts copied from upstream source)
- `log/`

Recommended source checkout location:

`vendor/kkfileview/source/kkFileView`

Why the runtime is not checked into Git:

- `kkFileView` build outputs are binary artifacts and should be generated during deployment.
- The project keeps only the integration scripts and documentation in Git.

Recommended flow:

1. Download or clone the upstream `kkFileView` source code.
2. Build and stage it into the project with `scripts/linux/build-kkfileview-from-source.sh`.
3. Start the full stack with `scripts/linux/start-stack.sh`.

Compatibility note:

- `scripts/linux/start-kkfileview.sh` supports both the project-managed source-build layout above and the upstream packaged layout with `bin/startup.sh`.
