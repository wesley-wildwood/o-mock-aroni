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

  const headers = rows.shift() || [];
  return rows
    .map((values) => normalizePickRow(Object.fromEntries(headers.map((header, i) => [header, values[i] || ""]))))
    .filter((row) => row.Contestant && Object.entries(row).some(([key, value]) => /^Golfer \d+$/.test(key) && value));
}

function normalizePickRow(row) {
  return {
    ...row,
    Contestant: row.Contestant || row.Teams || row.Team || "",
    "Alt 1": row["Alt 1"] || row["First Alt"] || row.First || "",
    "Alt 2": row["Alt 2"] || row["Second Alt"] || row.Second || "",
    "Alt 3": row["Alt 3"] || row["Third Alt"] || row.Third || "",
    "Alt 4": row["Alt 4"] || row["Fourth Alt"] || row.Fourth || "",
    "Alt 5": row["Alt 5"] || row["Fifth Alt"] || row.Fifth || ""
  };
}

export function roundPace(round, par = 70) {
  if (!round) return { score: null, state: "not_started" };
  if (round.strokes != null && round.holes >= 18) return { score: round.strokes, state: "complete" };
  if (round.toPar != null) return { score: round.holes > 0 ? par + round.toPar : null, state: round.holes > 0 ? "playing" : "not_started" };
  if (round.status === "not_started") return { score: null, state: "not_started" };
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

function buildRoundEntry({ pickName, player, roundNumber, par, column }) {
  const base = {
    key: `${column}:${normalizeName(pickName)}:${roundNumber}`,
    pickName,
    displayName: player?.name || pickNameToDisplay(pickName),
    player,
    roundNumber,
    round: null,
    score: null,
    state: "unavailable",
    counting: false,
    tieBreaking: false
  };
  if (!player) return base;
  const pace = playerRoundPace(player, roundNumber, par);
  return {
    ...base,
    round: pace.round || null,
    score: pace.score,
    state: pace.state
  };
}

function buildTeamGolfers(row, livePlayers, throughRound, par, columns) {
  const playersByName = buildPlayersByName(livePlayers);
  return columns.map((column) => {
    const pickName = row[column];
    const player = playersByName.get(normalizeName(pickNameToDisplay(pickName)));
    const rounds = Array.from({ length: throughRound }, (_, index) => {
      const roundNumber = index + 1;
      return buildRoundEntry({ pickName, player, roundNumber, par, column });
    });
    return {
      pickName,
      displayName: player?.name || pickNameToDisplay(pickName),
      player,
      rounds
    };
  });
}

function allRounds(golfers) {
  return golfers
    .flatMap((golfer) => golfer.rounds.map((round) => ({ ...round, pickName: golfer.pickName, displayName: golfer.displayName, player: golfer.player })))
    .filter((round) => round.score != null);
}

function sortedRounds(rounds) {
  return [...rounds].sort((a, b) => a.score - b.score || a.roundNumber - b.roundNumber || a.pickName.localeCompare(b.pickName));
}

function markCountingRounds(golfers, countingKeys, tieBreakKeys = new Set()) {
  return golfers.map((golfer) => ({
    ...golfer,
    rounds: golfer.rounds.map((round) => ({
      ...round,
      counting: countingKeys.has(round.key),
      tieBreaking: tieBreakKeys.has(round.key)
    }))
  }));
}

function buildPoolRows(picks, livePlayers, throughRound, par, columns) {
  return picks.map((pick) => ({
    contestant: pick.Contestant,
    golfers: buildTeamGolfers(pick, livePlayers, throughRound, par, columns)
  }));
}

function bestOneRoundPerGolfer(golfers) {
  return golfers
    .map((golfer) => sortedRounds(golfer.rounds.filter((round) => round.score != null))[0])
    .filter(Boolean);
}

function buildB4R4Rows(picks, livePlayers, selectedRound, par, columns) {
  const rows = buildPoolRows(picks, livePlayers, selectedRound, par, columns).map((team) => {
    const bestByGolfer = sortedRounds(bestOneRoundPerGolfer(team.golfers));
    const countedRounds = bestByGolfer.slice(0, 4);
    const tieBreakRounds = bestByGolfer.slice(4);
    const tieBreakRound = tieBreakRounds[0] || null;
    const countingKeys = new Set(countedRounds.map((round) => round.key));
    const tieBreakKeys = new Set(tieBreakRound ? [tieBreakRound.key] : []);
    const total = countedRounds.length ? countedRounds.reduce((sum, round) => sum + round.score, 0) : null;
    return {
      ...team,
      golfers: markCountingRounds(team.golfers, countingKeys, tieBreakKeys),
      countedRounds,
      countedRoundCount: countedRounds.length,
      tieBreakRound,
      tieBreakScores: tieBreakRounds.map((round) => round.score),
      total,
      toPar: total == null ? null : total - par * countedRounds.length
    };
  });

  return rankedRows(
    rows,
    (a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || compareScoreSequences(a.tieBreakScores, b.tieBreakScores),
    (a, b) => a.total === b.total && compareScoreSequences(a.tieBreakScores, b.tieBreakScores) === 0
  );
}

export const MAIN_GOLFER_COLUMNS = Array.from({ length: 7 }, (_, index) => `Golfer ${index + 1}`);
export const ALT_GOLFER_COLUMNS = Array.from({ length: 5 }, (_, index) => `Alt ${index + 1}`);

export function buildB4R4Leaderboard(picks, livePlayers, selectedRound, par = 70) {
  return buildB4R4Rows(picks, livePlayers, selectedRound, par, MAIN_GOLFER_COLUMNS);
}

export function buildAltB4R4Leaderboard(picks, livePlayers, selectedRound, par = 70) {
  return buildB4R4Rows(picks, livePlayers, selectedRound, par, ALT_GOLFER_COLUMNS);
}

export function formatToPar(score, parTotal) {
  if (score == null) return "—";
  const value = score - parTotal;
  return value === 0 ? "E" : value > 0 ? `+${value}` : String(value);
}
