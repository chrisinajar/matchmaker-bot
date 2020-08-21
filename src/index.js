import { getClient } from "./discord";
import { updateUser } from "./users";
import {
  isInMatchmaking,
  addToMatchmaking,
  removeFromMatchmaking,
  getUserCount,
} from "./matchmaker";
import {
  Emojis,
  instructionsText,
  betaWarningText,
  aboutBotText,
  enteredMatchmakingText,
} from "./strings";

const STOP_EMOJI = Emojis.octagonal_sign;

async function updateStatusMessage(channel, messages) {
  const message = messages[channel.guild.id];
  const guildId = channel.guild.id;
  console.log("Editing status message in", guildId, channel.guild.name);
  if (message) {
    message.delete();
  }
  const userCount = getUserCount(guildId);
  if (userCount === 0) {
    console.log("Sending initial");
    messages[guildId] = await channel.send(
      `Matchmaking is online and running!\n${betaWarningText()}${instructionsText()}`
    );
    return;
  }
  console.log("Sending count");
  messages[guildId] = await channel.send(
    `Matchmaking is online and running! There are ${userCount} users playing now!\n${betaWarningText()}${instructionsText()}`
  );
}

export default async function init() {
  const client = await getClient();

  const matchmakingStatusMessages = {};
  const matchmakingChannels = {};

  client.guilds.cache.reduce(async (wait, guild) => {
    await wait;
    console.log("Initializing in", guild.name);
    const guildId = guild.id;
    const matchmakingChannel = guild.channels.cache.find(
      (e) => e.name === "matchmaking"
    );
    matchmakingChannels[guildId] = matchmakingChannel;
    if (!matchmakingChannel) {
      console.error("Could not find matchmaking channel!");
      return;
    }
    await matchmakingChannel.fetch();
    await matchmakingChannel.messages.fetch();
    await Promise.all(
      matchmakingChannel.messages.cache
        .filter(
          (msg) =>
            msg.content === "!matchmaking" ||
            msg.content === "!mmr" ||
            msg.content === "!about" ||
            (msg.member.id === guild.me.id &&
              !msg.content.startsWith(`**${Emojis.trophy}`))
        )
        .map((msg) => msg.delete())
    );
    await updateStatusMessage(matchmakingChannel, matchmakingStatusMessages);
  }, null);

  client.on("message", async (msg) => {
    if (msg.content === "!matchmaking") {
      const guildId = msg.guild.id;
      const matchmakingChannel = matchmakingChannels[guildId];
      const state = isInMatchmaking(msg.member);
      if (state) {
        await removeFromMatchmaking(state.message.id);
      }
      const user = await updateUser(msg.member);
      const connectionMessage = await msg.reply(enteredMatchmakingText());
      addToMatchmaking(connectionMessage, user);
      await msg.delete();
      await connectionMessage.react(STOP_EMOJI);
      await updateStatusMessage(matchmakingChannel, matchmakingStatusMessages);
      await waitForMatchmakingExit(connectionMessage, user.id);
      removeFromMatchmaking(connectionMessage.id);

      await updateStatusMessage(matchmakingChannel, matchmakingStatusMessages);
    } else if (msg.content === "!mmr") {
      const user = await updateUser(msg.member);
      const roundedMMR = Math.round(user.mmr * 100) / 100;
      await msg.reply(`You have ${roundedMMR} MMR.`);
      await msg.delete();
    } else if (msg.content === "!about") {
      await msg.reply(aboutBotText());
      await msg.delete();
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
