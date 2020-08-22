import { timeout } from "thyming";
import { getClient } from "./discord";
import { saveMatch } from "./match";
import { setUser, mmrForGuild } from "./users";
import {
  Emojis,
  matchedText,
  matchText,
  matchDisputeText,
  matchPartialResults,
  matchWrongResults,
  matchCompletingResults,
  matchResults,
  matchSubmitted,
} from "./strings";
import { compareUsers } from "./mmr";

const MIN_MMR_DIFF = 50;
let matchmakingEntrants = {};
// start high
let minMmrDiff = MIN_MMR_DIFF * 2;
let matchTimer = null;

export function resetMatchmaker() {
  matchmakingEntrants = {};
  if (matchTimer) {
    matchTimer();
    matchTimer = null;
  }
}

export function isInMatchmaking(user) {
  return Object.values(matchmakingEntrants).find(
    (entry) => entry.user.id === user.id
  );
}

export function getMatch(user) {
  return Object.values(matchmakingEntrants).find(
    (entry) => entry.user.id === user.id
  );
}

export async function addToMatchmaking(connectionMessage, user) {
  matchmakingEntrants[connectionMessage.id] = {
    message: connectionMessage,
    user,
  };
  scheduleTick();
}

export async function removeFromMatchmaking(messageId, reason) {
  const state = matchmakingEntrants[messageId];
  if (!state) {
    return;
  }
  delete matchmakingEntrants[messageId];
  if (reason) {
    await state.message.channel.send(`<@${state.user.id}> ${reason}`);
  }
  await state.message.delete();

  if (state.currentMatch) {
    endMatch(state.currentMatch);
  }
}

export function endMatch(match) {
  const [firstUser, secondUser] = match.users;
  firstUser.isMatched = false;
  secondUser.isMatched = false;
  firstUser.inGame = false;
  secondUser.inGame = false;
  firstUser.currentMatch = null;
  secondUser.currentMatch = null;

  if (match.currentQuestion) {
    match.currentQuestion.delete();
  }
}

export function getUserCount(guildId) {
  return Object.values(matchmakingEntrants).filter(
    (entry) => entry.message.guild.id === guildId
  ).length;
}

export function hasRecentlyPlayed(userA, userB) {
  const recentMatches = (userA.recentMatches || []).slice(0, 5);

  return !!recentMatches.find((entry) => {
    if (entry.userId !== userB.id) {
      return false;
    }
    if (Date.now() > entry.endTime + 1000 * 60 * 5) {
      return false;
    }
    return true;
  });
}

export function getUserMatches() {
  const validUsers = Object.values(matchmakingEntrants).filter(
    (entry) => !entry.inGame && !entry.isMatched
  );
  const guilds = validUsers
    .filter((entry, i) => validUsers.indexOf(entry) === i)
    .map((entry) => entry.message.guild.id);

  return guilds.reduce((matches, guildId) => {
    const queue = validUsers
      .filter((entry) => entry.message.guild.id === guildId)
      .sort(
        (a, b) => mmrForGuild(a.user, guildId) - mmrForGuild(b.user, guildId)
      );

    if (queue.length < 2) {
      return matches;
    }

    return matches.concat(calculateMatches(queue));
  }, []);
}
export function calculateMatches(queue) {
  const matches = [];

  // only grow mmr diff if there's enough users queued
  minMmrDiff = (minMmrDiff + 1) * 1.1;

  queue.forEach((entry, i) => {
    if (i === 0) {
      return;
    }
    if (entry.inGame || entry.isMatched) {
      return;
    }
    const previousEntry = queue[i - 1];
    const guildId = entry.message.guild.id;
    if (previousEntry.message.guild.id !== guildId) {
      return;
    }
    if (previousEntry.inGame || previousEntry.isMatched) {
      return;
    }
    if (
      hasRecentlyPlayed(entry.user, previousEntry.user) ||
      hasRecentlyPlayed(previousEntry.user, entry.user)
    ) {
      console.log("recent match", entry.user);
      return;
    }
    const myMmr = mmrForGuild(entry.user, guildId);
    const mmrDiff = Math.abs(mmrForGuild(previousEntry.user, guildId) - myMmr);
    minMmrDiff = Math.min(minMmrDiff, mmrDiff * 1.1);
    if (mmrDiff <= minMmrDiff) {
      entry.isMatched = true;
      previousEntry.isMatched = true;
      matches.push({
        users: [entry, previousEntry],
        mmrDiff,
      });
    }
  });

  minMmrDiff = Math.max(minMmrDiff, MIN_MMR_DIFF);

  console.log("The minimum mmr different is", minMmrDiff);

  return matches;
}

async function tick() {
  if (matchTimer) {
    matchTimer();
  }
  const matches = getUserMatches();

  if (!matches.length) {
    scheduleTick(60000);
    return;
  }
  console.log("I think these matches should happen now", matches);

  // const client = await getClient();

  await Promise.all(
    matches.map(async (match) => {
      console.log("This match should happen", match);
      const [firstUser, secondUser] = match.users;
      firstUser.currentMatch = match;
      secondUser.currentMatch = match;

      const {
        message: { channel },
      } = firstUser;
      const message = await channel.send(matchedText(match));
      match.currentQuestion = message;
      await Promise.all([
        message.react(Emojis.white_check_mark),
        message.react(Emojis.no_entry),
      ]);
      runMatch(message, match);
    })
  );

  scheduleTick();
}

export async function runMatch(message, match) {
  const [firstUser, secondUser] = match.users;
  const guildId = message.guild.id;

  try {
    await waitForMatchReactions(message, match);
    await message.edit("Setting up match results...");
    await message.reactions.removeAll();
    await Promise.all([
      message.react(Emojis.arrow_left),
      message.react(Emojis.arrow_down),
      message.react(Emojis.arrow_right),
      message.react(Emojis.no_entry),
    ]);
    await message.edit(matchText(match));
    await saveMatch(match, message.id);
    const [results] = await waitForMatchResults(message, match);
    console.log("Finished with match, got results!", results);

    if (results.disputed) {
      console.log("This match was disputed! D:");
      match.disputed = true;
    } else {
      const mmrChanges = compareUsers(
        mmrForGuild(firstUser.user, guildId),
        mmrForGuild(secondUser.user, guildId)
      );
      console.log(mmrChanges);
      if (!results.canceled && !results.disputed) {
        const resultArray = [results.firstWon, results.secondWon];
        match.users.forEach((entry, i) => {
          if (resultArray[i]) {
            entry.user.mmr[guildId] += mmrChanges[i].win;
          } else {
            entry.user.mmr[guildId] += mmrChanges[i].lose;
          }
        });
      }
    }

    await saveMatch(match, message.id);
    match.users.forEach((match) => {
      setUser(match.user);
    });
  } catch (e) {
    match.rejected = true;
    match.currentQuestion = null;
    await message.delete();
  } finally {
    match.currentQuestion = null;
    firstUser.isMatched = false;
    secondUser.isMatched = false;
    firstUser.user.recentMatches.push({
      userId: secondUser.user.id,
      endTime: Date.now() + (match.rejected ? 600000 : 0),
    });
    secondUser.user.recentMatches.push({
      userId: firstUser.user.id,
      endTime: Date.now() + (match.rejected ? 600000 : 0),
    });

    scheduleTick();
  }
}

export async function waitForMatchReactions(message, match) {
  const [firstUser, secondUser] = match.users;
  let firstAnswered = null;
  let secondAnswered = null;

  const collector = message.createReactionCollector((reaction, user) => {
    // ignore other users
    if (user.id !== firstUser.user.id && user.id !== secondUser.user.id) {
      return false;
    }
    // ignore other emojis
    if (
      reaction.emoji.name !== Emojis.no_entry &&
      reaction.emoji.name !== Emojis.white_check_mark
    ) {
      return false;
    }
    return true;
  }, {});

  collector.on("collect", (r, user) => {
    // remove existing emoji
    if (user.id === firstUser.user.id) {
      console.log("first user is reacting", firstAnswered);
      if (r.emoji.name === Emojis.no_entry) {
        collector.stop();
      } else if (r.emoji.name === Emojis.white_check_mark) {
        firstAnswered = true;
      }
    }
    if (user.id === secondUser.user.id) {
      console.log("second user is reacting", secondAnswered);
      if (r.emoji.name === Emojis.no_entry) {
        collector.stop();
      } else if (r.emoji.name === Emojis.white_check_mark) {
        secondAnswered = true;
      }
    }

    if (secondAnswered !== null && firstAnswered !== null) {
      collector.stop();
    }
  });
  return new Promise((resolve, reject) => {
    let ended = false;
    const cancelTimer = timeout(() => {
      console.log("Match timeout...");
      ended = true;
      reject();

      const reason =
        "You didn't accept your match in time and have been removed from the matchmaking queue, use `!matchmaking` to rejoin at any time!";

      if (firstAnswered === null) {
        removeFromMatchmaking(firstUser.message.id, reason);
      }
      if (secondAnswered === null) {
        removeFromMatchmaking(secondUser.message.id, reason);
      }
    }, 60000);

    collector.on("end", (collected) => {
      cancelTimer();
      if (ended) {
        return;
      }
      ended = true;
      if (!firstAnswered || !secondAnswered) {
        reject();
      }
      resolve();
    });
  });
}

export async function waitForMatchResults(message, match) {
  const [firstUser, secondUser] = match.users;
  match.results = [{}, {}];
  const [firstResult, secondResult] = match.results;

  const collector = message.createReactionCollector((reaction, user) => {
    // ignore other users
    if (user.id !== firstUser.user.id && user.id !== secondUser.user.id) {
      return false;
    }
    // ignore other emojis
    if (
      reaction.emoji.name !== Emojis.no_entry &&
      reaction.emoji.name !== Emojis.arrow_left &&
      reaction.emoji.name !== Emojis.arrow_down &&
      reaction.emoji.name !== Emojis.arrow_right
    ) {
      return false;
    }
    return true;
  }, {});

  collector.on("collect", (r, user) => {
    r.users.remove(user);
    if (match.timer) {
      match.timer();
      match.timer = null;
    }
    const resultObject =
      user.id === firstUser.user.id ? firstResult : secondResult;
    if (r.emoji.name === Emojis.no_entry) {
      // dispute result
      resultObject.disputed = !resultObject.disputed;
    }
    if (r.emoji.name === Emojis.arrow_down) {
      // match canceled
      resultObject.canceled = !resultObject.canceled;
      resultObject.firstWon = false;
      resultObject.secondWon = false;
    }
    if (r.emoji.name === Emojis.arrow_left) {
      // firstUser won
      resultObject.firstWon = !resultObject.firstWon;
      resultObject.canceled = false;
      resultObject.secondWon = false;
    }
    if (r.emoji.name === Emojis.arrow_right) {
      // secondUser won
      resultObject.secondWon = !resultObject.secondWon;
      resultObject.firstWon = false;
      resultObject.canceled = false;
    }

    const disputed = match.results.some((result) => result.disputed);
    const hasResults = match.results.some(
      (result) => resultToBitfield(result) > 0
    );
    const hasIncompleteResults = match.results.some(
      (result) => resultToBitfield(result) === 0
    );
    const hasDifferentResults =
      resultToBitfield(firstResult) !== resultToBitfield(secondResult);

    if (disputed) {
      message.edit(
        `${matchText(match)}${matchResults(match)}${matchDisputeText(match)}`
      );
    } else if (hasResults && hasIncompleteResults) {
      message.edit(
        `${matchText(match)}${matchResults(match)}${matchPartialResults(match)}`
      );
    } else if (hasResults && hasDifferentResults) {
      message.edit(
        `${matchText(match)}${matchResults(match)}${matchWrongResults(match)}`
      );
    } else if (hasResults) {
      // they agree and submitted
      message.edit(`${matchText(match)}${matchCompletingResults(match)}`);
      match.timer = timeout(() => {
        message.edit(`${matchSubmitted(match)}`);
        message.reactions.removeAll();
        collector.stop();
        console.log("Done?");
      }, 10000);
    }
  });

  return new Promise((resolve) =>
    collector.on("end", () => resolve(match.results))
  );
}

export function resultToBitfield(result) {
  return (
    (result.disputed << 0) +
    (result.canceled << 1) +
    (result.firstWon << 2) +
    (result.secondWon << 3)
  );
}

export function scheduleTick(extraTime = 0) {
  if (matchTimer) {
    matchTimer();
  }
  matchTimer = timeout(tick, 1000 + extraTime);
}
