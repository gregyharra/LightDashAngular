import { withClassicModuleFederation } from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-lineage',
  exposes: {
    './Routes': './apps/remote-lineage/src/app/remote-entry/entry.routes.ts',
  },
});
