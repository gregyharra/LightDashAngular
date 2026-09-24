import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-tables',
  exposes: {
    './Routes': './apps/remote-tables/src/app/remote-entry/entry.routes.ts',
  },
});
