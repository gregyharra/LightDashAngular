import type { ModuleFederationConfig } from '@nx/module-federation';

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
