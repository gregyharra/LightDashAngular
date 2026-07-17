# mds-worker

Runs background dbt jobs against `mds-transform` and uploads artifacts for `mds-backend` to ingest.

## Planned job flow

```text
1. Receive job from mds-backend (project, git ref, commands)
2. git clone mds-transform @ branch/commit
3. dbt deps → dbt compile → dbt docs generate → (optional) dbt run
4. Upload target/manifest.json, catalog.json, logs to object storage
5. POST callback to mds-backend /internal/artifacts/ingest
```

## Status

Scaffold only. Implement in Phase B5 (see `docs/MDS_BACKEND_PLATFORM_SETUP.md`).

## Future layout

```text
src/worker/
  jobs/dbt_compile.py
  jobs/dbt_run.py
  callbacks/backend_client.py
  storage/artifacts.py
workflows/          # Argo Workflow templates
```
