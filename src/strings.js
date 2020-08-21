export const Emojis = {
  white_check_mark: "✅",
  no_entry: "🚫",
  octagonal_sign: "🛑",
  arrow_left: "⬅️",
  arrow_right: "➡️",
  arrow_down: "⬇️",
  bangbang: "‼️",
  warning: "⚠️",
  speech_balloon: "💬",
  couple: "👫",
  two_men_holding_hands: "👬",
  two_women_holding_hands: "👭",
  trophy: "🏆",
};

export function randomMatchEmoji() {
  const options = [
    "couple",
    "two_men_holding_hands",
    "two_women_holding_hands",
  ];
  return Emojis[options[~~(Math.random() * options.length)]];
}

export function matchedText(match) {
  const [firstUser, secondUser] = match.users;
  return `**MATCH FOUND!!**
${randomMatchEmoji()} <@${firstUser.user.id}> (${firstUser.user.mmr}) and <@${
    secondUser.user.id
  }> (${secondUser.user.mmr}) should play!

${Emojis.white_check_mark} Accept match
${Emojis.no_entry} Reject match

`;
}

export function matchText(match) {
  const [firstUser, secondUser] = match.users;
  return `Once the match is complete, report the match result using the following reactions:

 - ${Emojis.arrow_left} <@${firstUser.user.id}> has won the set
 - ${Emojis.arrow_right} <@${secondUser.user.id}> has won the set
 - ${Emojis.arrow_down} Tie or otherwise canceled match
 - ${Emojis.no_entry} Disputed result
`;
}

export function matchDisputeText() {
  return `
${Emojis.bangbang} **This match's results are being disputed**
`;
}

export function matchPartialResults() {
  return `
${Emojis.speech_balloon} This match has partial results reported...
`;
}

export function matchWrongResults() {
  return `
${Emojis.warning} **The reported results do not match, use ${Emojis.no_entry} to dispute the result**
`;
}

export function matchWinnerText(match) {
  const [firstUser, secondUser] = match.users;
  const [result] = match.results;

  if (result.firstWon) {
    return `**${Emojis.trophy} Winner** <@${firstUser.user.id}>`;
  }
  if (result.secondWon) {
    return `**${Emojis.trophy} Winner** <@${secondUser.user.id}>`;
  }
  if (result.canceled) {
    return `**Match canceled**`;
  }
  return "";
}
export function matchWinnerLoserText(match) {
  const [firstUser, secondUser] = match.users;
  const [result] = match.results;

  if (result.firstWon) {
    return `**${Emojis.trophy} <@${firstUser.user.id}>** defeated **<@${secondUser.user.id}> ${Emojis.trophy}**`;
  }
  if (result.secondWon) {
    return `**${Emojis.trophy} <@${secondUser.user.id}>** defeated **<@${firstUser.user.id}> ${Emojis.trophy}**`;
  }
  if (result.canceled) {
    return `**Match canceled**`;
  }
  return "";
}

export function matchCompletingResults(match) {
  return `
${matchWinnerText(match)}

${Emojis.speech_balloon} Processing results...
`;
}

export function matchSubmitted(match) {
  return `
${matchWinnerLoserText(match)}

${Emojis.white_check_mark} Results submitted!
`;
}

export function matchResults(match) {
  const [firstUser, secondUser] = match.users;
  const [firstEmojis, secondEmojis] = match.results.map(resultToEmojis);
  const result = [""];

  if (firstEmojis.length) {
    result.push(`<@${firstUser.user.id}>'s result: ${firstEmojis.join(" ")}`);
  }
  if (secondEmojis.length) {
    result.push(`<@${secondUser.user.id}>'s result: ${secondEmojis.join(" ")}`);
  }
  result.push("");

  return result.join("\n");
}

export function resultToEmojis(result) {
  const emojis = [];
  if (result.disputed) {
    emojis.push(Emojis.no_entry);
  }
  if (result.canceled) {
    emojis.push(Emojis.arrow_down);
  }
  if (result.firstWon) {
    emojis.push(Emojis.arrow_left);
  }
  if (result.secondWon) {
    emojis.push(Emojis.arrow_right);
  }
  return emojis;
}

export function instructionsText() {
  return `
**Commands:**
 - \`!matchmaking\` Enter the matchmaking queue
 - \`!mmr\` Get your current mmr value
 - \`!about\` Information about this bot and its development
`;
}

export function betaWarningText() {
  return `
${Emojis.warning} This bot is a work in progress, report bugs!
`;
}
export function aboutBotText() {
  return `Matchmaker is a nodejs bot written by chrisinajar <https://github.com/chrisinajar> for the Jazz Improv melee community

 - Source code: https://github.com/chrisinajar/matchmaker-bot
 - Development roadmap: <https://github.com/chrisinajar/matchmaker-bot#roadmap>
 - Report issues or give feedback: <https://github.com/chrisinajar/matchmaker-bot/issues>
`;
}

export function enteredMatchmakingText() {
  return `You're now entered into matchmaking! React with ${Emojis.octagonal_sign} to leave the queue.
You don't need to watch this channel, I'll mention you if a match is found!`;
}
