import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-export',
  exposes: {
    './Routes': './apps/remote-export/src/app/remote-entry/entry.routes.ts',
  },
});
