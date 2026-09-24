import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-ai',
  exposes: {
    './Routes': './apps/remote-ai/src/app/remote-entry/entry.routes.ts',
  },
});
