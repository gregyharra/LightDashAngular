import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-explorer',
  exposes: {
    './Routes': './apps/remote-explorer/src/app/remote-entry/entry.routes.ts',
  },
});
