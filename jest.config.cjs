/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.spec\\.ts$',

  preset: 'ts-jest',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^typeorm$': '<rootDir>/node_modules/typeorm',
    '^uuid$': require.resolve('uuid'),
  },

  transformIgnorePatterns: ['/node_modules/'],

  testEnvironmentOptions: {
    customExportConditions: ['node', 'require'],
  },

  setupFiles: ['reflect-metadata'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],

  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
};
