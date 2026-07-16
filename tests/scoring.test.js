import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildARTLeaderboard,
  buildAltB4RLeaderboard,
  buildB4RLeaderboard,
  buildBROWLeaderboard,
  buildFlushLeaderboard,
  buildStraightLeaderboard,
  normalizeName,
  parsePicksCsv,
  roundPace
} from "../public/scoring.js";

const MAIN_COUNT = 10;
const ALT_COUNT = 6;

function pick(contestant, mainScores = {}, altScores = {}) {
  const row = { Contestant: contestant };
  const players = [];
  for (let index = 1; index <= MAIN_COUNT; index += 1) {
    const pickName = `${contestant} Main${index}, Player`;
    row[`Golfer ${index}`] = pickName;
    players.push(playerFromScores(pickName, mainScores[index] || []));
  }
  for (let index = 1; index <= ALT_COUNT; index += 1) {
    const pickName = `${contestant} Alt${index}, Player`;
    row[`Alt ${index}`] = pickName;
    players.push(playerFromScores(pickName, altScores[index] || []));
  }
  return { row, players };
}

function playerFromScores(pickName, scores, par = 71) {
  const [last, first] = pickName.split(", ");
  return {
    name: `${first} ${last}`,
    tournamentToPar: scores.reduce((sum, score) => sum + score - par, 0),
    rounds: Object.fromEntries(scores.map((score, index) => [
      index + 1,
      { strokes: score, toPar: score - par, holes: 18, status: "complete" }
    ]))
  };
}

test("normalizes accented live-feed names", () => {
  assert.equal(normalizeName("Ludvig Åberg"), normalizeName("Ludvig Aberg"));
  assert.equal(normalizeName("Nicolai Højgaard"), normalizeName("Nicolai Hojgaard"));
});

test("parses quoted golfer names from CSV", () => {
  const rows = parsePicksCsv('Contestant,Golfer 1\r\n"Smith, Sam","McIlroy, Rory"\r\n');
  assert.equal(rows[0].Contestant, "Smith, Sam");
  assert.equal(rows[0]["Golfer 1"], "McIlroy, Rory");
});

test("normalizes O'Moroney team and alternate headers", () => {
  const [row] = parsePicksCsv('Teams,Golfer 1,First,Second,Third,Fourth,Fifth,Sixth\r\n"Smith, Sam","Main, Max","Alt, One","Alt, Two","Alt, Three","Alt, Four","Alt, Five","Alt, Six"\r\n');
  assert.equal(row.Contestant, "Smith, Sam");
  assert.equal(row["Alt 1"], "Alt, One");
  assert.equal(row["Alt 4"], "Alt, Four");
  assert.equal(row["Alt 6"], "Alt, Six");
});

test("uses current score to par as 18-hole pace", () => {
  assert.deepEqual(roundPace({ strokes: 34, toPar: -1, holes: 9 }, 71), { score: 70, state: "playing" });
  assert.deepEqual(roundPace({ strokes: 68, toPar: -3, holes: 18 }, 71), { score: 68, state: "complete" });
  assert.deepEqual(roundPace({ strokes: null, toPar: null, holes: 0, status: "not_started" }, 71), { score: null, state: "not_started" });
  assert.deepEqual(roundPace({ strokes: null, toPar: 0, holes: 0, status: "not_started" }, 71), { score: null, state: "not_started" });
});

test("B4R takes the best four rounds from any of the ten main golfers", () => {
  const a = pick("A", { 1: [68, 67, 66, 65], 2: [80], 3: [81], 4: [82], 5: [83], 6: [84], 7: [85], 8: [86] });
  const b = pick("B", { 1: [67], 2: [68], 3: [69], 4: [70], 5: [71], 6: [72], 7: [73], 8: [74] });
  const rows = buildB4RLeaderboard([a.row, b.row], [...a.players, ...b.players], 4, 71);

  assert.equal(rows[0].contestant, "A");
  assert.equal(rows[0].total, 266);
  assert.deepEqual(rows[0].countedRounds.map((round) => [round.pickName, round.roundNumber, round.score]), [
    ["A Main1, Player", 4, 65],
    ["A Main1, Player", 3, 66],
    ["A Main1, Player", 2, 67],
    ["A Main1, Player", 1, 68]
  ]);
});

test("B4R ties are broken by the next best available rounds", () => {
  const a = pick("A", { 1: [68], 2: [69], 3: [70], 4: [71], 5: [72], 6: [75], 7: [76], 8: [77] });
  const b = pick("B", { 1: [68], 2: [69], 3: [70], 4: [71], 5: [73], 6: [74], 7: [75], 8: [76] });
  const rows = buildB4RLeaderboard([a.row, b.row], [...a.players, ...b.players], 1, 71);

  assert.equal(rows[0].contestant, "A");
  assert.equal(rows[0].total, 278);
  assert.equal(rows[0].tieBreakRound.score, 72);
  assert.equal(rows[0].golfers.some((golfer) => golfer.rounds.some((round) => round.tieBreaking && round.score === 72)), true);
  assert.deepEqual(rows[0].tieBreakScores.slice(0, 2), [72, 75]);
  assert.deepEqual(rows[1].tieBreakScores.slice(0, 2), [73, 74]);
});

test("B4R rank keeps score groups while ordering ties by tiebreakers", () => {
  const a = pick("A", { 1: [68], 2: [69], 3: [70], 4: [71], 5: [72], 6: [80], 7: [81], 8: [82] });
  const b = pick("B", { 1: [68], 2: [69], 3: [70], 4: [71], 5: [73], 6: [74], 7: [75], 8: [76] });
  const c = pick("C", { 1: [69], 2: [70], 3: [71], 4: [72], 5: [73], 6: [74], 7: [75], 8: [76] });
  const d = pick("D", { 1: [69], 2: [70], 3: [71], 4: [72], 5: [74], 6: [75], 7: [76], 8: [77] });
  const e = pick("E", { 1: [70], 2: [71], 3: [72], 4: [73], 5: [74], 6: [75], 7: [76], 8: [77] });
  const rows = buildB4RLeaderboard(
    [b.row, d.row, e.row, c.row, a.row],
    [...b.players, ...d.players, ...e.players, ...c.players, ...a.players],
    1,
    71
  );

  assert.deepEqual(rows.map((row) => [row.contestant, row.total, row.rank]), [
    ["A", 278, 1],
    ["B", 278, 2],
    ["C", 282, 3],
    ["D", 282, 3],
    ["E", 286, 5]
  ]);
});

test("not-started rounds do not count toward B4R standings", () => {
  const team = pick("Waiting", {
    1: [68],
    2: [69],
    3: [70],
    4: [71],
    5: [72],
    6: [73],
    7: [74],
    8: [75]
  });
  team.players.forEach((player) => {
    player.rounds[2] = { strokes: null, toPar: 0, holes: 0, status: "not_started" };
  });

  const [row] = buildB4RLeaderboard([team.row], team.players, 2, 71);

  assert.equal(row.total, 278);
  assert.equal(row.countedRounds.every((round) => round.roundNumber === 1), true);
  assert.equal(row.golfers.some((golfer) => golfer.rounds.some((round) => round.roundNumber === 2 && round.score != null)), false);
});

test("BROW sums each main golfer's best round of the week", () => {
  const team = pick("BROW", {
    1: [75, 69],
    2: [70, 74],
    3: [72],
    4: [68],
    5: [71],
    6: [73],
    7: [67],
    8: [76],
    9: [66],
    10: [77]
  });
  const [row] = buildBROWLeaderboard([team.row], team.players, 2, 71);

  assert.equal(row.total, 709);
  assert.equal(row.countedRoundCount, 10);
});

test("BROW ties use the cumulative second-best round total", () => {
  const a = pick("A", {
    1: [68, 70],
    2: [69, 71],
    3: [70, 72],
    4: [71, 73],
    5: [72, 74],
    6: [73, 75],
    7: [74, 76],
    8: [75, 77],
    9: [76, 78],
    10: [77, 79]
  });
  const b = pick("B", {
    1: [68, 71],
    2: [69, 72],
    3: [70, 73],
    4: [71, 74],
    5: [72, 75],
    6: [73, 76],
    7: [74, 77],
    8: [75, 78],
    9: [76, 78],
    10: [77, 79]
  });
  const rows = buildBROWLeaderboard([b.row, a.row], [...b.players, ...a.players], 2, 71);

  assert.deepEqual(rows.map((row) => [row.contestant, row.total, row.tieBreakTotal, row.rank]), [
    ["A", 725, 745, 1],
    ["B", 725, 753, 2]
  ]);
});

test("BROW replaces withdrawn starters with the first alternate", () => {
  const team = pick("WD", {
    1: [68, 69],
    2: [70],
    3: [71],
    4: [72],
    5: [73],
    6: [74],
    7: [75],
    8: [76]
  }, { 1: [65, 66] });
  const withdrawn = team.players.find((player) => player.name === "Player WD Main1");
  withdrawn.status = "withdrawn";

  const [row] = buildBROWLeaderboard([team.row], team.players, 2, 71);
  const replacement = row.golfers[0];

  assert.equal(replacement.replacement, true);
  assert.equal(replacement.pickName, "WD Alt1, Player");
  assert.equal(replacement.replacementFor, "WD Main1, Player");
  assert.equal(row.countedRounds.some((round) => round.pickName === "WD Alt1, Player" && round.score === 65), true);
  assert.equal(row.countedRounds.some((round) => round.pickName === "WD Main1, Player"), false);
});

test("ART sums all ten main golfers across rounds one and two", () => {
  const team = pick("ART", Object.fromEntries(Array.from({ length: 10 }, (_, index) => [index + 1, [70 + index, 71 + index]])));
  const [row] = buildARTLeaderboard([team.row], team.players, 4, 71);

  assert.equal(row.countedRoundCount, 20);
  assert.equal(row.throughRound, 2);
  assert.equal(row.total, 1500);
});

test("Alt B4R takes the best four alternate rounds across the week", () => {
  const team = pick("ALT", {}, {
    1: [70, 75, 72],
    2: [69, 74, 71],
    3: [73, 68, 76],
    4: [72, 73, 67],
    5: [66, 80, 79],
    6: [78, 77, 65]
  });
  const [row] = buildAltB4RLeaderboard([team.row], team.players, 3, 71);

  assert.equal(row.total, 266);
  assert.deepEqual(row.countedRounds.map((round) => [round.pickName, round.roundNumber, round.score]), [
    ["ALT Alt6, Player", 3, 65],
    ["ALT Alt5, Player", 1, 66],
    ["ALT Alt4, Player", 3, 67],
    ["ALT Alt3, Player", 2, 68]
  ]);
});

test("Alt B4R rank keeps score groups while ordering ties by tiebreakers", () => {
  const a = pick("A", {}, { 1: [68], 2: [69], 3: [70], 4: [71], 5: [72], 6: [80] });
  const b = pick("B", {}, { 1: [68], 2: [69], 3: [70], 4: [71], 5: [73], 6: [74] });
  const c = pick("C", {}, { 1: [69], 2: [70], 3: [71], 4: [72], 5: [73], 6: [74] });
  const d = pick("D", {}, { 1: [69], 2: [70], 3: [71], 4: [72], 5: [74], 6: [75] });
  const e = pick("E", {}, { 1: [70], 2: [71], 3: [72], 4: [73], 5: [74], 6: [75] });
  const rows = buildAltB4RLeaderboard(
    [b.row, d.row, e.row, c.row, a.row],
    [...b.players, ...d.players, ...e.players, ...c.players, ...a.players],
    1,
    71
  );

  assert.deepEqual(rows.map((row) => [row.contestant, row.total, row.rank]), [
    ["A", 278, 1],
    ["B", 278, 2],
    ["C", 282, 3],
    ["D", 282, 3],
    ["E", 286, 5]
  ]);
});

test("Straight uses main golfer rounds and favors the lowest starting score", () => {
  const low = pick("Low", { 1: [68], 2: [69], 3: [70], 4: [71], 5: [75], 6: [76], 7: [77], 8: [78] });
  const high = pick("High", { 1: [69], 2: [70], 3: [71], 4: [72], 5: [75], 6: [76], 7: [77], 8: [78] });
  const rows = buildStraightLeaderboard([low.row, high.row], [...low.players, ...high.players], 1, 71);

  assert.equal(rows[0].contestant, "Low");
  assert.deepEqual(rows[0].runScores, [68, 69, 70, 71]);
});

test("Flush uses main golfer rounds and favors lower equal-size groups", () => {
  const lower = pick("Lower", { 1: [69], 2: [69], 3: [69], 4: [72], 5: [73], 6: [74], 7: [75], 8: [76] });
  const higher = pick("Higher", { 1: [70], 2: [70], 3: [70], 4: [71], 5: [72], 6: [73], 7: [74], 8: [75] });
  const rows = buildFlushLeaderboard([lower.row, higher.row], [...lower.players, ...higher.players], 1, 71);

  assert.equal(rows[0].contestant, "Lower");
  assert.equal(rows[0].flushCount, 3);
  assert.equal(rows[0].flushScore, 69);
});

test("missed-cut golfers remain visible but cannot count in weekend rounds", () => {
  const team = pick("Cut", { 1: [68, 69, 70], 2: [71, 72, 73], 3: [74], 4: [75], 5: [76], 6: [77], 7: [78], 8: [79] });
  const cutPlayer = team.players.find((player) => player.name === "Player Cut Main1");
  cutPlayer.status = "missed_cut";
  const [row] = buildB4RLeaderboard([team.row], team.players, 3, 71);
  const cutGolfer = row.golfers.find((golfer) => golfer.pickName === "Cut Main1, Player");

  assert.equal(cutGolfer.rounds[2].state, "missed_cut");
  assert.equal(cutGolfer.rounds[2].score, null);
  assert.equal(row.countedRounds.some((round) => round.key === "Golfer 1:cutmain1player:3"), false);
});

test("O'Moroney picks include 45 teams with 10 main golfers and 6 alternates", () => {
  const rows = parsePicksCsv(readFileSync(new URL("../public/data/omoroney-picks.csv", import.meta.url), "utf8"));
  assert.equal(rows.length, 45);
  assert.equal(new Set(rows.map((row) => row.Contestant)).size, 45);
  for (const row of rows) {
    assert.equal(new Set(Array.from({ length: 10 }, (_, index) => row[`Golfer ${index + 1}`])).size, 10);
    assert.equal(new Set(Array.from({ length: 6 }, (_, index) => row[`Alt ${index + 1}`])).size, 6);
  }
});
