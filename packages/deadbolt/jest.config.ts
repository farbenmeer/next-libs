import { type Config } from "jest";

const config: Config = {
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.tsx?$": "@swc/jest",
  },
  moduleNameMapper: {
    "^src/(.*)": "<rootDir>/src/$1",
  },
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.ts", "!**.test.{ts,tsx,js,jsx}", "!**/node_modules/**"],
  coverageReporters: ["lcovonly"],
};

export default config;
