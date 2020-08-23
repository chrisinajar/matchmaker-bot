import colors from "ansi-colors";
import { timeout } from "thyming";
import { getClient } from "./discord";
import { updateUser, mmrForGuild } from "./users";
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
  uptimeText,
} from "./strings";

const STOP_EMOJI = Emojis.octagonal_sign;

function scheduleStatusMessageUpdate(channel, messages, time = 60000) {
  if (channel.timerId) {
    channel.timerId();
    channel.timerId = null;
  }

  channel.timerId = timeout(() => {
    updateStatusMessage(channel, messages);
  }, time);
}

async function updateStatusMessage(channel, messages) {
  // auto-refresh every 10 minutes
  scheduleStatusMessageUpdate(channel, messages, 1000 * 60 * 10);
  const message = messages[channel.guild.id];
  const guildId = channel.guild.id;
  let messageText = "Matchmaking is online and running! ";
  const userCount = getUserCount(guildId);
  if (userCount === 0) {
    messageText += `No one is playing, **be the first to queue up!**\n${uptimeText()}${betaWarningText()}${instructionsText()}`;
  } else {
    messageText += `Matchmaking is online and running! There are ${userCount} users playing now!\n${uptimeText()}${betaWarningText()}${instructionsText()}`;
  }
  messageText = messageText.trim();
  if (message) {
    if (channel.lastMessage && channel.lastMessage.id === message.id) {
      if (message.content !== messageText) {
        await message.edit(messageText);
      }
      return;
    }
    message.delete();
  }
  messages[guildId] = await channel.send(messageText);
}

export default async function init() {
  const client = await getClient();

  await client.user.setActivity("maths", { type: "WATCHING" });

  const matchmakingStatusMessages = {};
  const matchmakingChannels = {};

  client.guilds.cache.reduce(async (wait, guild) => {
    await wait;
    console.log("Initializing in", guild.name);
    const guildId = guild.id;
    const matchmakingChannel = guild.channels.cache.find(
      (e) =>
        e.name.toLowerCase() === "matchmaking" ||
        e.name.toLowerCase() === "ranked"
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
    // get away from "just now" faster?
    scheduleStatusMessageUpdate(
      matchmakingChannel,
      matchmakingStatusMessages,
      120000
    );
  }, null);

  client.on("message", async (msg) => {
    const guildId = msg.guild.id;
    const matchmakingChannel = matchmakingChannels[guildId];
    if (msg.channel.id !== matchmakingChannel.id) {
      return;
    }
    if (msg.member.id === msg.guild.me.id) {
      return;
    }
    console.log(
      colors.yellow(msg.guild.name),
      colors.cyan(msg.member.user.username),
      msg.content
    );

    scheduleStatusMessageUpdate(matchmakingChannel, matchmakingStatusMessages);

    if (msg.content === "!matchmaking") {
      const user = await updateUser(msg.member);
      const state = isInMatchmaking(msg.member);
      if (state) {
        await msg.delete();
        const replyMessage = await msg.reply(
          `You are already queued for matchmaking. React with ${Emojis.octagonal_sign} to leave the queue`
        );
        await replyMessage.react(STOP_EMOJI);
        await waitForMatchmakingExit(replyMessage, user.id);
        await removeFromMatchmaking(state.message.id);
        await replyMessage.delete();

        return;
        // await removeFromMatchmaking(state.message.id);
      }
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
      const roundedMMR =
        Math.round(mmrForGuild(user, msg.guild.id) * 100) / 100;
      await msg.reply(`You have ${roundedMMR} MMR.`);
      await msg.delete();
    } else if (msg.content === "!about") {
      await msg.reply(aboutBotText());
      await msg.delete();
      await updateStatusMessage(matchmakingChannel, matchmakingStatusMessages);
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
