/* eslint-env jest */
import {
  isInMatchmaking,
  addToMatchmaking,
  removeFromMatchmaking,
  getUserCount,
  resetMatchmaker,
  getUserMatches,
} from "./matchmaker";

const message = {
  id: "messageId",
  delete: jest.fn(),
  guild: {
    id: "guildId",
  },
};

const message2 = {
  id: "messageId2",
  delete: jest.fn(),
  guild: {
    id: "guildId",
  },
};

const user = {
  id: "userId",
  username: "chrisinajar",
  mmr: 1000,
  recentMatches: [],
};
const user2 = {
  id: "userId2",
  username: "kilbanks",
  mmr: 1001,
  recentMatches: [],
};

describe("matchmaker", () => {
  beforeEach(() => resetMatchmaker());

  it("user count increases when you add people", () => {
    expect(getUserCount("guildId")).toBe(0);
    addToMatchmaking(message, user);
    expect(getUserCount("guildId")).toBe(1);
  });

  it("can query if a user is in matchmaking", () => {
    addToMatchmaking(message, user);
    expect(isInMatchmaking(user)).toBeTruthy();
  });

  it("can remove users from matchmaking", () => {
    addToMatchmaking(message, user);
    expect(getUserCount("guildId")).toBe(1);
    expect(isInMatchmaking(user)).toBeTruthy();
    removeFromMatchmaking(message.id);
    expect(getUserCount("guildId")).toBe(0);
    expect(isInMatchmaking(user)).not.toBeTruthy();
  });

  it("matches two users of similar mmrs", () => {
    addToMatchmaking(message, user);
    addToMatchmaking(message2, user2);
    expect(getUserCount("guildId")).toBe(2);

    const results = getUserMatches();
    expect(results.length).toBe(1);
    const [result] = results;
    expect(isInMatchmaking(user).isMatched).toBeTruthy();
    expect(result.users).toContain(isInMatchmaking(user));
    expect(result.users).toContain(isInMatchmaking(user2));
  });

  it("doesn't match two users of similar mmrs", () => {
    addToMatchmaking(message, user);
    addToMatchmaking(message2, { ...user2, mmr: 1200 });
    expect(getUserCount("guildId")).toBe(2);

    const results = getUserMatches();
    expect(results.length).toBe(0);
  });

  it("can reset", () => {
    addToMatchmaking(message, user);
    expect(getUserCount("guildId")).toBe(1);
    resetMatchmaker();
    expect(getUserCount("guildId")).toBe(0);
  });
});
