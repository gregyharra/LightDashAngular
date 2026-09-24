import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-charts',
  exposes: {
    './Routes': './apps/remote-charts/src/app/remote-entry/entry.routes.ts',
  },
});
