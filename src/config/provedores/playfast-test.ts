import { TestStrategy } from "./test-types";

export const PLAYFAST_TEST_STRATEGY: TestStrategy = {
  steps: [
    {
      type: 'json-post',
      endpoints: ['/profile'],
      label: 'Playfast Profile Check',
    },
  ],
};
