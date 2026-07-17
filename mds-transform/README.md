# mds-transform

dbt project for the MDS platform. This is the **source of truth** for data models.

The sample **Jaffle Shop** project was copied from the UI mock fixtures. In production, this repo is cloned by `mds-worker` to compile and run models.

## Layout

```text
mds-transform/
  dbt_project.yml
  models/
  seeds/
```

## Local dbt commands

Requires a Trino profile (see `profiles.example.yml`).

```bash
cd mds-transform
dbt deps
dbt compile          # → target/manifest.json (lineage)
dbt docs generate    # → target/catalog.json (columns)
dbt run              # materialize tables in Trino
```

## Pointing at a different dbt project

The UI reads dbt metadata from the backend, which loads compiled artifacts from a **local directory** configured in `mds-backend/.env`:

```env
DBT_PROJECT_PATH=/absolute/path/to/my/dbt/project
```

Then run `dbt compile && dbt docs generate` in that directory. To switch projects, change the path and restart the backend (or call `POST /api/v1/projects/{uuid}/refresh`).

You can also keep using this folder as the default sample project, or replace its contents with your own models.

| File | Used for |
|---|---|
| `target/manifest.json` | Lineage graph, dbt-tree |
| `target/catalog.json` | Column metadata on lineage nodes |
| `target/run_results.json` | Model run status (via mds-worker) |
