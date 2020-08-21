/* eslint-env jest */

import { compareUsers } from "./mmr";

describe("mmr", () => {
  it("calculates changes correctly", () => {
    const result = compareUsers(1000, 1100);
    expect(result[0].elo).toBeLessThan(0.5);
    expect(result[1].elo).toBeGreaterThan(0.5);
    expect(result[0].win).toBeGreaterThan(result[0].lose);
    expect(result[1].win).toBeGreaterThan(result[1].lose);

    expect(result[0].win).toBeGreaterThan(result[1].win);
  });
});
