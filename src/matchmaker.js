import { timeout } from "thyming";
import { getClient } from "./discord";
import { createMatch } from "./match";
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

const MIN_MMR_DIFF = 50;
let matchmakingEntrants = {};
let minMmrDiff = MIN_MMR_DIFF;
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

export async function removeFromMatchmaking(messageId) {
  const state = matchmakingEntrants[messageId];
  if (!state) {
    return;
  }
  delete matchmakingEntrants[messageId];
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

export function getUserCount() {
  return Object.keys(matchmakingEntrants).length;
}

export function hasRecentlyPlayed(userA, userB) {
  const recentMatches = userA.recentMatches.slice(0, 5);

  return !!recentMatches.find((entry) => {
    if (entry.userId !== userB.id) {
      return false;
    }
    if (Date.now() > entry.endTime + 1000 * 60) {
      return false;
    }
    return true;
  });
}

export function getUserMatches() {
  minMmrDiff = (minMmrDiff + 1) * 1.1;
  const matches = [];
  const queue = Object.values(matchmakingEntrants)
    .filter((entry) => !entry.inGame)
    .sort((a, b) => a.user.mmr - b.user.mmr);

  queue.forEach((entry, i) => {
    if (i === 0) {
      return;
    }
    if (entry.inGame || entry.isMatched) {
      return;
    }
    const previousEntry = queue[i - 1];
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
    const myMmr = entry.user.mmr;
    const mmrDiff = Math.abs(previousEntry.user.mmr - myMmr);
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
  console.log("matchmaker tick");
  const matches = getUserMatches();
  console.log("I think these matches should happen now", matches);

  if (!matches.length) {
    scheduleTick(60000);
    return;
  }

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
        const matchData = await createMatch(match, message.id);
        await waitForMatchResults(message, match);
        console.log("Finished with match, got results!", matchData);
      } catch (e) {
        match.currentQuestion = null;
        await message.delete();
        firstUser.isMatched = false;
        secondUser.isMatched = false;
        firstUser.user.recentMatches.push({
          userId: secondUser.user.id,
          endTime: Date.now(),
        });
        secondUser.user.recentMatches.push({
          userId: firstUser.user.id,
          endTime: Date.now(),
        });
      }
    })
  );

  scheduleTick();
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
    collector.on("end", (collected) => {
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
      message.edit(`${matchText(match)}${matchDisputeText(match)}`);
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

  return new Promise((resolve) => collector.on("end", () => resolve()));
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
