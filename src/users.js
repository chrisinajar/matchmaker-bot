import { getDB } from "./db";

export async function getUser(userId) {
  const userDB = await getDB("users");
  try {
    const user = await userDB.get(userId);

    return parseUser(user);
  } catch (err) {
    if (err.type !== "NotFoundError") {
      throw err;
    }
  }
  return null;
}

export async function setUser(userData) {
  const userDB = await getDB("users");
  return userDB.put(userData.id, userData);
}

export function updateUserData(user, member) {
  return {
    ...user,
    ...member.user,
  };
}

export function createUser(member) {
  console.log("Creating a new user!", member.user.username);
  const user = {
    id: member.id,
  };
  return updateUserData(user, member);
}

export async function updateUser(member) {
  let user = await getUser(member.id);
  if (!user) {
    user = createUser(member);
  } else {
    user = updateUserData(user, member);
  }
  await setUser(user);
  return parseUser(user);
}

export function mmrForGuild(user, guildId) {
  if (!user.mmr[guildId]) {
    user.mmr[guildId] = 1000;
  }
  return user.mmr[guildId];
}

export function parseUser(user) {
  if (!user.mmr || typeof user.mmr !== "object") {
    user.mmr = {};
  }
  if (!user.recentMatches) {
    user.recentMatches = [];
  }

  return user;
}
