const MAX_K = 80;
const MIN_MMR = 500;
const MID_MMR = 1000;
const MASTER_MMR = 2000;

export function getKFactor(mmr) {
  if (mmr < MIN_MMR) {
    return MAX_K;
  }
  if (mmr >= MIN_MMR && mmr < MID_MMR) {
    return MAX_K / 2;
  }
  if (mmr >= MID_MMR && mmr < MASTER_MMR) {
    // eaze from MID_MMR to MASTER_MMR approaching 16
    return MAX_K / 2 - (MAX_K / 4) * (mmr / MID_MMR - 1);
  }

  return MAX_K / 4; // master player
}

export function getElo(score0, score1) {
  // still just elo
  return 1 / (1 + Math.pow(10, (score1 - score0) / 400));
}

export function getMMRChange(mmr, elo, result) {
  return getKFactor(mmr) * (result - elo);
}

export function compareUsers(mmrA, mmrB) {
  const expectedA = getElo(mmrA, mmrB);
  const expectedB = getElo(mmrB, mmrA);

  return [
    {
      elo: expectedA,
      win: getMMRChange(mmrA, expectedA, 1),
      lose: getMMRChange(mmrA, expectedA, 0),
    },
    {
      elo: expectedB,
      win: getMMRChange(mmrB, expectedB, 1),
      lose: getMMRChange(mmrB, expectedB, 0),
    },
  ];
}

// export function calculateTeamScores(team, scoreChange, matchID) {
//   scoreChange = Math.round(scoreChange * Math.min(2, team.length));
//   // scoreChange = Math.round(scoreChange * 2);
//   team.forEach((player) => {
//     var myElo = 1;
//     if (team.length > 1) {
//       var averageMMRWithoutMe =
//         team
//           .filter((otherPlayer) => {
//             return player !== otherPlayer;
//           })
//           .reduce((score, otherPlayer) => {
//             return otherPlayer.mmr + score;
//           }, 0) /
//         (team.length - 1);
//       myElo = getElo(averageMMRWithoutMe, player.mmr);
//     }

//     if (scoreChange < 0) {
//       myElo *= 0.2;
//     }

//     player.adjustedMMR = player.mmr + scoreChange * myElo;
//   });
// }

// export function getExpectedScore(match) {
//   var team0 = match.dire;
//   var team1 = match.radiant;

//   var team0MMR = team0.reduce((score, player) => {
//     return score + player.mmr;
//   }, 0);
//   var team1MMR = team1.reduce((score, player) => {
//     return score + player.mmr;
//   }, 0);
//   var team0AverageMMR = team0MMR / team0.length;
//   var team1AverageMMR = team1MMR / team1.length;
//   var team0ExpectedScore = getElo(team0AverageMMR, team1AverageMMR);
//   var team1ExpectedScore = getElo(team1AverageMMR, team0AverageMMR);

//   return [team0ExpectedScore, team1ExpectedScore];
// }

// export function processScores(match, score0, score1) {
//   var team0 = match.radiant;
//   var team1 = match.dire;

//   var team0MMR = team0.reduce((score, player) => {
//     return score + player.mmr;
//   }, 0);
//   var team1MMR = team1.reduce((score, player) => {
//     return score + player.mmr;
//   }, 0);
//   var team0AverageMMR = team0MMR / team0.length;
//   var team1AverageMMR = team1MMR / team1.length;
//   var team0ExpectedScore = getElo(team0AverageMMR, team1AverageMMR);
//   var team1ExpectedScore = getElo(team1AverageMMR, team0AverageMMR);
//   var team0Score = score0 > score1 ? 0 : 1;
//   var team1Score = 1 - team0Score;
//   var team0K = getKFactor(team0AverageMMR);
//   var team1K = getKFactor(team1AverageMMR);
//   var team0MMRAdjustment = team0K * (team0Score - team0ExpectedScore);
//   var team1MMRAdjustment = team1K * (team1Score - team1ExpectedScore);

//   calculateTeamScores(team0, team0MMRAdjustment, match._id);
//   calculateTeamScores(team1, team1MMRAdjustment, match._id);

//   match.state = "done";

//   return match;
// }
