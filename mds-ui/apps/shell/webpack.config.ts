import {
  shellDevRemotes,
  withClassicModuleFederation,
} from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'shell',
  remotes: shellDevRemotes(),
});
