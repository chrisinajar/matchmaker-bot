import { getDB } from "./db";

export async function saveMatch(_match, id) {
  const match = { ..._match };
  const db = await getDB("matches");
  match.id = id;
  match.users.forEach((m) => delete m.currentMatch);
  delete match.currentQuestion;
  await db.put(id, match);

  return match;
}
