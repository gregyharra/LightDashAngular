export default {
  displayName: 'mf-base',
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }] },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/webpack.mf.base.spec.ts'],
};
