import { getClient } from "./discord";
import { updateUser } from "./users";
import {
  isInMatchmaking,
  addToMatchmaking,
  removeFromMatchmaking,
  getUserCount,
} from "./matchmaker";
import { Emojis } from "./strings";

const STOP_EMOJI = Emojis.octagonal_sign;

async function updateStatusMessage(channel, message) {
  if (message) {
    message.delete();
  }
  const userCount = getUserCount();
  if (userCount === 0) {
    return channel.send(`Matchmaking is online and running!`);
  }
  return channel.send(
    `Matchmaking is online and running! There are ${userCount} users playing now!`
  );
}

export default async function init() {
  const client = await getClient();

  let matchmakingStatusMessage = null;
  let matchmakingChannel = null;

  client.guilds.cache.map(async (guild) => {
    if (matchmakingStatusMessage) {
      return;
    }
    matchmakingChannel = guild.channels.cache.find(
      (e) => e.name === "matchmaking"
    );
    if (!matchmakingChannel) {
      matchmakingChannel = await guild.channels.create("matchmaking");
    }
    if (!matchmakingChannel) {
      console.error("Could not create matchmaking channel!");
    }
    await matchmakingChannel.fetch();
    await matchmakingChannel.messages.fetch();
    matchmakingChannel.messages.cache
      .filter((msg) => msg.member.id === guild.me.id)
      .map((msg) => msg.delete());
    matchmakingStatusMessage = await matchmakingChannel.send(
      "Matchmaking is online and running!"
    );
  });

  client.on("message", async (msg) => {
    if (msg.content === "!matchmaking") {
      const state = isInMatchmaking(msg.member);
      if (state) {
        await removeFromMatchmaking(state.message.id);
      }
      const user = await updateUser(msg.member);
      const connectionMessage = await msg.reply(
        `You're now entered into matchmaking! React with ${STOP_EMOJI} to stop`
      );
      addToMatchmaking(connectionMessage, user);
      await msg.delete();
      await connectionMessage.react(STOP_EMOJI);
      matchmakingStatusMessage = await updateStatusMessage(
        matchmakingChannel,
        matchmakingStatusMessage
      );
      await waitForMatchmakingExit(connectionMessage, user.id);
      removeFromMatchmaking(connectionMessage.id);

      matchmakingStatusMessage = await updateStatusMessage(
        matchmakingChannel,
        matchmakingStatusMessage
      );
    }
  });
}

export async function waitForMatchmakingExit(message, userId) {
  const collector = message.createReactionCollector(
    (reaction, user) => {
      if (user.id !== userId) {
        return false;
      }
      if (reaction.emoji.name !== STOP_EMOJI) {
        return false;
      }
      return true;
    },
    { max: 1 }
  );

  return new Promise((resolve) => collector.on("collect", () => resolve()));
}
