import type { ModuleFederationConfig } from '@nx/module-federation';

/** Data-only: `@nx/angular:module-federation-dev-server` reads this to start dev remotes. Webpack MF uses `webpack.mf.base.ts`. */
const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: [
    'remote-auth',
    'remote-projects',
    'remote-warehouses',
    'remote-tables',
    'remote-explorer',
    'remote-charts',
    'remote-dashboards',
    'remote-lineage',
    'remote-ai',
    'remote-export',
  ],
};

export default config;
