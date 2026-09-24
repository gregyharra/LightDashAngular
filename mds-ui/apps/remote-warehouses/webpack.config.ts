import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-warehouses',
  exposes: {
    './Routes': './apps/remote-warehouses/src/app/remote-entry/entry.routes.ts',
  },
});
