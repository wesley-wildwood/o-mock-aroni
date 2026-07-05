import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildARTLeaderboard,
  buildAltBRODLeaderboard,
  buildB4RLeaderboard,
  buildBROWLeaderboard,
  buildFlushLeaderboard,
  buildStraightLeaderboard,
  normalizeName,
  parsePicksCsv,
  roundPace
} from "../public/scoring.js";

function pick(contestant, mainScores = {}, altScores = {}) {
  const row = { Contestant: contestant };
  const players = [];
  for (let index = 1; index <= 8; index += 1) {
    const pickName = `${contestant} Main${index}, Player`;
    row[`Golfer ${index}`] = pickName;
    players.push(playerFromScores(pickName, mainScores[index] || []));
  }
  for (let index = 1; index <= 4; index += 1) {
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
  assert.deepEqual(rows, [{ Contestant: "Smith, Sam", "Golfer 1": "McIlroy, Rory" }]);
});

test("uses current score to par as 18-hole pace", () => {
  assert.deepEqual(roundPace({ strokes: 34, toPar: -1, holes: 9 }, 71), { score: 70, state: "playing" });
  assert.deepEqual(roundPace({ strokes: 68, toPar: -3, holes: 18 }, 71), { score: 68, state: "complete" });
  assert.deepEqual(roundPace({ strokes: null, toPar: null, holes: 0, status: "not_started" }, 71), { score: 71, state: "not_started" });
});

test("B4R takes the best four rounds from any of the eight main golfers", () => {
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
  assert.deepEqual(rows[0].tieBreakScores.slice(0, 2), [72, 75]);
  assert.deepEqual(rows[1].tieBreakScores.slice(0, 2), [73, 74]);
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
    8: [76]
  });
  const [row] = buildBROWLeaderboard([team.row], team.players, 2, 71);

  assert.equal(row.total, 558);
  assert.equal(row.countedRoundCount, 8);
});

test("ART sums all eight main golfers across rounds one and two", () => {
  const team = pick("ART", Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index + 1, [70 + index, 71 + index]])));
  const [row] = buildARTLeaderboard([team.row], team.players, 4, 71);

  assert.equal(row.countedRoundCount, 16);
  assert.equal(row.throughRound, 2);
  assert.equal(row.total, 1184);
});

test("Alt BROD takes the best alternate round each day", () => {
  const team = pick("ALT", {}, {
    1: [70, 75, 72],
    2: [69, 74, 71],
    3: [73, 68, 76],
    4: [72, 73, 67]
  });
  const [row] = buildAltBRODLeaderboard([team.row], team.players, 3, 71);

  assert.equal(row.total, 204);
  assert.deepEqual(row.countedRounds.map((round) => [round.pickName, round.roundNumber, round.score]), [
    ["ALT Alt2, Player", 1, 69],
    ["ALT Alt3, Player", 2, 68],
    ["ALT Alt4, Player", 3, 67]
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
  assert.equal(row.countedRounds.some((round) => round.key === "cutmain1player:3"), false);
});

test("John Deere picks include 100 teams with 8 main golfers and 4 alternates", () => {
  const rows = parsePicksCsv(readFileSync(new URL("../public/data/john-deere-picks.csv", import.meta.url), "utf8"));
  assert.equal(rows.length, 100);
  assert.equal(new Set(rows.map((row) => row.Contestant)).size, 100);
  for (const row of rows) {
    assert.equal(new Set(Array.from({ length: 8 }, (_, index) => row[`Golfer ${index + 1}`])).size, 8);
    assert.equal(new Set(Array.from({ length: 4 }, (_, index) => row[`Alt ${index + 1}`])).size, 4);
  }
});
