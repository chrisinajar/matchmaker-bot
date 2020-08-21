import Discord from "discord.js";

let currentClientPromise = null;

export async function createClient() {
  if (!process.env.DISCORD_TOKEN) {
    console.error(
      "No DISCORD_TOKEN defined, create a .env or add this to your environment"
    );
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
    const client = new Discord.Client();

    client.on("ready", () => resolve(client));
    try {
      client.login(process.env.DISCORD_TOKEN);
    } catch (err) {
      console.error("There was an error creating the client!", err);
    }
  });
}

export async function getClient() {
  if (currentClientPromise) {
    return currentClientPromise;
  }
  currentClientPromise = createClient();
  return currentClientPromise;
}
