
/**
 * @type {import("@jest/types").Config.ProjectConfig}
 */
module.exports = {
  preset: 'ts-jest',
  testTimeout: 120 * 1000,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!**/node_modules/**"
  ],
  coveragePathIgnorePatterns: [
    "node_modules/",
  ],
  testEnvironment: "node",
  testRegex: "/test/.*\\.test\\.ts$",
  moduleFileExtensions: [
    "ts",
    "js",
    "json"
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  reporters: ["default", ["jest-junit", { outputDirectory: "coverage" }]]
};
