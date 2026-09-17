import type { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'shell',
  remotes: [
    'remote-auth',
    'remote-projects',
    'remote-warehouses',
    'remote-tables',
    'remoteExplorer',
    'remoteCharts',
    'remoteDashboards',
    'remoteLineage',
    'remoteAi',
    'remoteExport',
  ],
};

export default config;
