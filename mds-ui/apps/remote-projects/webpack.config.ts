import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-projects',
  exposes: {
    './Routes': './apps/remote-projects/src/app/remote-entry/entry.routes.ts',
  },
});
