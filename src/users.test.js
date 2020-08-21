/* eslint-env jest */
import { getDB } from "./db";
import { getUser, updateUser } from "./users";

describe("users", () => {
  it("should have a default mmr value", async () => {
    await updateUser({
      id: 123,
      user: {
        username: "chrisinajar",
      },
    });
    const user = await getUser(123);
    expect(user.mmr).toBeTruthy();
  });
});
