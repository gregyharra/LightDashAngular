import type { ModuleFederationConfig } from '@nx/module-federation';

/** Data-only for Nx module-federation-dev-server discovery. Webpack MF uses webpack.mf.base.ts. */
const config: ModuleFederationConfig = {
  name: 'remote-warehouses',
  exposes: {
    './Routes': 'apps/remote-warehouses/src/app/remote-entry/entry.routes.ts',
  },
};

export default config;
