import type { ModuleFederationConfig } from '@nx/module-federation';

/** Data-only for Nx module-federation-dev-server discovery. Webpack MF uses webpack.mf.base.ts. */
const config: ModuleFederationConfig = {
  name: 'remote-lineage',
  exposes: {
    './Routes': 'apps/remote-lineage/src/app/remote-entry/entry.routes.ts',
  },
};

/**
* Nx requires a default export of the config to allow correct resolution of the module federation graph.
**/
export default config;
