import { TestStrategy } from "./test-types";

export const SIGMA_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'json-post',
      endpoints: ['/api/auth/login'],
      label: 'Sigma API Login',
    },
  ],
};
