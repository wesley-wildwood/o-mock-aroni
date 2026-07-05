export function normalizeName(name = "") {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function pickNameToDisplay(name) {
  const [last, first] = name.split(",").map((part) => part.trim());
  return first ? `${first} ${last}` : name;
}

export function parsePicksCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift();
  return rows.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] || ""])));
}

export function roundPace(round, par = 71) {
  if (!round) return { score: par, state: "not_started" };
  if (round.strokes != null && round.holes >= 18) return { score: round.strokes, state: "complete" };
  if (round.toPar != null) return { score: par + round.toPar, state: round.holes > 0 ? "playing" : "not_started" };
  if (round.status === "not_started") return { score: par, state: "not_started" };
  return { score: null, state: round.status || "unavailable" };
}

function playerRoundPace(player, roundNumber, par) {
  if (roundNumber >= 3 && (player?.status === "missed_cut" || player?.status === "withdrawn")) {
    return { score: null, state: player.status, round: null };
  }
  const round = player?.rounds?.[roundNumber] || player?.rounds?.[String(roundNumber)] || null;
  return { ...roundPace(round, par), round };
}

function compareScoreSequences(left = [], right = []) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? Infinity) - (right[index] ?? Infinity);
    if (difference) return difference;
  }
  return 0;
}

function rankedRows(rows, compare, sameRank = (a, b) => compare(a, b) === 0) {
  rows.sort((a, b) => compare(a, b) || a.contestant.localeCompare(b.contestant));
  let previous = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = previous && sameRank(previous, row) ? previousRank : index + 1;
    previous = row;
    previousRank = rank;
    return { ...row, rank };
  });
}

function buildPlayersByName(livePlayers) {
  return new Map(livePlayers.map((player) => [normalizeName(player.name), player]));
}

function buildTeamGolfers(row, livePlayers, throughRound, par, columns) {
  const playersByName = buildPlayersByName(livePlayers);
  return columns.map((column) => {
    const pickName = row[column];
    const player = playersByName.get(normalizeName(pickNameToDisplay(pickName)));
    const rounds = Array.from({ length: throughRound }, (_, index) => {
      const roundNumber = index + 1;
      if (!player) {
        return {
          key: `${normalizeName(pickName)}:${roundNumber}`,
          pickName,
          displayName: pickNameToDisplay(pickName),
          player: null,
          roundNumber,
          round: null,
          score: null,
          state: "unavailable",
          counting: false
        };
      }
      const pace = playerRoundPace(player, roundNumber, par);
      return {
        key: `${normalizeName(pickName)}:${roundNumber}`,
        pickName,
        displayName: player?.name || pickNameToDisplay(pickName),
        player,
        roundNumber,
        round: pace.round || null,
        score: pace.score,
        state: pace.state,
        counting: false
      };
    });
    return { pickName, displayName: player?.name || pickNameToDisplay(pickName), player, rounds };
  });
}

function allRounds(golfers, { includeNotStarted = true } = {}) {
  return golfers
    .flatMap((golfer) => golfer.rounds.map((round) => ({ ...round, pickName: golfer.pickName, displayName: golfer.displayName, player: golfer.player })))
    .filter((round) => round.score != null && (includeNotStarted || round.state !== "not_started"));
}

function sortedRounds(rounds) {
  return [...rounds].sort((a, b) => a.score - b.score || a.roundNumber - b.roundNumber || a.pickName.localeCompare(b.pickName));
}

function markCountingRounds(golfers, countingKeys) {
  return golfers.map((golfer) => ({
    ...golfer,
    rounds: golfer.rounds.map((round) => ({ ...round, counting: countingKeys.has(round.key) }))
  }));
}

function buildPoolRows(picks, livePlayers, throughRound, par, columns) {
  return picks.map((pick) => ({
    contestant: pick.Contestant,
    golfers: buildTeamGolfers(pick, livePlayers, throughRound, par, columns)
  }));
}

export const MAIN_GOLFER_COLUMNS = Array.from({ length: 8 }, (_, index) => `Golfer ${index + 1}`);
export const ALT_GOLFER_COLUMNS = Array.from({ length: 4 }, (_, index) => `Alt ${index + 1}`);

export function buildB4RLeaderboard(picks, livePlayers, selectedRound, par = 71) {
  const rows = buildPoolRows(picks, livePlayers, selectedRound, par, MAIN_GOLFER_COLUMNS).map((team) => {
    const postedRounds = sortedRounds(allRounds(team.golfers));
    const countedRounds = postedRounds.slice(0, 4);
    const countingKeys = new Set(countedRounds.map((round) => round.key));
    const total = countedRounds.length ? countedRounds.reduce((sum, round) => sum + round.score, 0) : null;
    return {
      ...team,
      golfers: markCountingRounds(team.golfers, countingKeys),
      countedRounds,
      countedRoundCount: countedRounds.length,
      tieBreakScores: postedRounds.slice(4).map((round) => round.score),
      total,
      toPar: total == null ? null : total - par * countedRounds.length
    };
  });

  const compare = (a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || compareScoreSequences(a.tieBreakScores, b.tieBreakScores);
  return rankedRows(rows, compare);
}

export function buildBROWLeaderboard(picks, livePlayers, selectedRound, par = 71) {
  const rows = buildPoolRows(picks, livePlayers, selectedRound, par, MAIN_GOLFER_COLUMNS).map((team) => {
    const bestByGolfer = team.golfers.flatMap((golfer) => {
      const best = sortedRounds(golfer.rounds.filter((round) => round.score != null))[0];
      return best ? [{ ...best, pickName: golfer.pickName }] : [];
    });
    const countingKeys = new Set(bestByGolfer.map((round) => round.key));
    const total = bestByGolfer.length ? bestByGolfer.reduce((sum, round) => sum + round.score, 0) : null;
    return {
      ...team,
      golfers: markCountingRounds(team.golfers, countingKeys),
      countedRounds: sortedRounds(bestByGolfer),
      countedRoundCount: bestByGolfer.length,
      total,
      toPar: total == null ? null : total - par * bestByGolfer.length
    };
  });

  return rankedRows(rows, (a, b) => (a.total ?? Infinity) - (b.total ?? Infinity), (a, b) => a.total === b.total);
}

export function buildARTLeaderboard(picks, livePlayers, selectedRound, par = 71) {
  const throughRound = Math.min(2, Math.max(1, selectedRound));
  const rows = buildPoolRows(picks, livePlayers, throughRound, par, MAIN_GOLFER_COLUMNS).map((team) => {
    const rounds = allRounds(team.golfers);
    const countingKeys = new Set(rounds.map((round) => round.key));
    const total = rounds.length ? rounds.reduce((sum, round) => sum + round.score, 0) : null;
    return {
      ...team,
      golfers: markCountingRounds(team.golfers, countingKeys),
      countedRounds: sortedRounds(rounds),
      countedRoundCount: rounds.length,
      total,
      toPar: total == null ? null : total - par * rounds.length,
      throughRound
    };
  });

  return rankedRows(rows, (a, b) => (a.total ?? Infinity) - (b.total ?? Infinity), (a, b) => a.total === b.total);
}

export function buildAltBRODLeaderboard(picks, livePlayers, selectedRound, par = 71) {
  const rows = buildPoolRows(picks, livePlayers, selectedRound, par, ALT_GOLFER_COLUMNS).map((team) => {
    const dailyBests = [];
    for (let roundNumber = 1; roundNumber <= selectedRound; roundNumber += 1) {
      const dailyRounds = sortedRounds(allRounds(team.golfers).filter((round) => round.roundNumber === roundNumber));
      if (dailyRounds[0]) dailyBests.push(dailyRounds[0]);
    }
    const countingKeys = new Set(dailyBests.map((round) => round.key));
    const total = dailyBests.length ? dailyBests.reduce((sum, round) => sum + round.score, 0) : null;
    return {
      ...team,
      golfers: markCountingRounds(team.golfers, countingKeys),
      countedRounds: dailyBests,
      countedRoundCount: dailyBests.length,
      total,
      toPar: total == null ? null : total - par * dailyBests.length
    };
  });

  return rankedRows(rows, (a, b) => (a.total ?? Infinity) - (b.total ?? Infinity), (a, b) => a.total === b.total);
}

function awardEligibleRounds(team) {
  return allRounds(team.golfers, { includeNotStarted: false });
}

export function buildStraightLeaderboard(picks, livePlayers, selectedRound, par = 71) {
  const rows = buildPoolRows(picks, livePlayers, selectedRound, par, MAIN_GOLFER_COLUMNS).map((team) => {
    const rounds = awardEligibleRounds(team);
    const scores = [...new Set(rounds.map((round) => round.score))].sort((a, b) => a - b);
    const runs = [];
    for (let startIndex = 0; startIndex < scores.length; startIndex += 1) {
      let endIndex = startIndex;
      while (endIndex + 1 < scores.length && scores[endIndex + 1] === scores[endIndex] + 1) endIndex += 1;
      const runScores = scores.slice(startIndex, endIndex + 1);
      runs.push({ runScores, length: runScores.length, startScore: runScores[0] ?? Infinity });
      startIndex = endIndex;
    }
    const bestRun = runs.sort((a, b) => b.length - a.length || a.startScore - b.startScore)[0]
      || { runScores: [], length: 0, startScore: Infinity };
    const highlightedScores = new Set(bestRun.runScores);
    const countingKeys = new Set(rounds.filter((round) => highlightedScores.has(round.score)).map((round) => round.key));
    return { ...team, golfers: markCountingRounds(team.golfers, countingKeys), ...bestRun };
  });

  const compare = (a, b) => b.length - a.length || a.startScore - b.startScore;
  return rankedRows(rows, compare);
}

function compareFlushGroups(a = [], b = []) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] || { count: 0, score: Infinity };
    const right = b[index] || { count: 0, score: Infinity };
    if (left.count !== right.count) return right.count - left.count;
    if (left.score !== right.score) return left.score - right.score;
  }
  return 0;
}

export function buildFlushLeaderboard(picks, livePlayers, selectedRound, par = 71) {
  const rows = buildPoolRows(picks, livePlayers, selectedRound, par, MAIN_GOLFER_COLUMNS).map((team) => {
    const rounds = awardEligibleRounds(team);
    const counts = new Map();
    for (const round of rounds) counts.set(round.score, (counts.get(round.score) || 0) + 1);
    const groups = [...counts].map(([score, count]) => ({ score, count })).sort((a, b) => b.count - a.count || a.score - b.score);
    const primary = groups[0] || { score: null, count: 0 };
    const countingKeys = new Set(rounds.filter((round) => round.score === primary.score).map((round) => round.key));
    return { ...team, golfers: markCountingRounds(team.golfers, countingKeys), groups, flushScore: primary.score, flushCount: primary.count };
  });

  return rankedRows(rows, (a, b) => compareFlushGroups(a.groups, b.groups));
}

export function formatToPar(score, parTotal) {
  if (score == null) return "—";
  const value = score - parTotal;
  return value === 0 ? "E" : value > 0 ? `+${value}` : String(value);
}
