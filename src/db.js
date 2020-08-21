import path from "path";
import fs from "fs";
import level from "level";

let dbFolder;
if (process.env.NODE_ENV === "test") {
  dbFolder = path.join(__dirname, "../test-data");
} else {
  dbFolder = path.join(__dirname, "../data");
}

export async function createClient(name) {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(dbFolder, name);
    fs.mkdir(dbFolder, (err) => {
      if (err && err.code !== "EEXIST") {
        return reject(err);
      }
      const db = level(dbPath, {
        valueEncoding: "json",
      });
      return resolve(db);
    });
  });
}

let dbPromises = {};
export async function getDB(name) {
  if (dbPromises[name]) {
    return dbPromises[name];
  }
  dbPromises[name] = createClient(name);
  return dbPromises[name];
}
