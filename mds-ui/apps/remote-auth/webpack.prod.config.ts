import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-auth',
  exposes: {
    './Routes': './apps/remote-auth/src/app/remote-entry/entry.routes.ts',
  },
});
