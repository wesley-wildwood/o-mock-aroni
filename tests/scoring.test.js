import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAltB4R4Leaderboard,
  buildB4R4Leaderboard,
  normalizeName,
  parsePicksCsv,
  roundPace
} from "../public/scoring.js";

const MAIN_COUNT = 7;
const ALT_COUNT = 5;

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

function playerFromScores(pickName, scores, par = 70) {
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

test("parses quoted team and golfer names from CSV", () => {
  const rows = parsePicksCsv('Team,Golfer 1,Alt 1\r\n"Smith, Sam","McIlroy, Rory","Kim, Tom"\r\n');
  assert.equal(rows[0].Contestant, "Smith, Sam");
  assert.equal(rows[0]["Golfer 1"], "McIlroy, Rory");
  assert.equal(rows[0]["Alt 1"], "Kim, Tom");
});

test("uses current score to par as 18-hole pace and ignores not-started rounds", () => {
  assert.deepEqual(roundPace({ strokes: 34, toPar: -1, holes: 9 }, 70), { score: 69, state: "playing" });
  assert.deepEqual(roundPace({ strokes: 68, toPar: -2, holes: 18 }, 70), { score: 68, state: "complete" });
  assert.deepEqual(roundPace({ strokes: null, toPar: 0, holes: 0, status: "not_started" }, 70), { score: null, state: "not_started" });
});

test("B4R4 takes best four rounds from four different main golfers", () => {
  const a = pick("A", { 1: [62, 63, 64, 65], 2: [66], 3: [67], 4: [68], 5: [80], 6: [81], 7: [82] });
  const b = pick("B", { 1: [66], 2: [67], 3: [68], 4: [69], 5: [70], 6: [71], 7: [72] });
  const rows = buildB4R4Leaderboard([a.row, b.row], [...a.players, ...b.players], 4, 70);

  assert.equal(rows[0].contestant, "A");
  assert.equal(rows[0].total, 263);
  assert.deepEqual(rows[0].countedRounds.map((round) => [round.pickName, round.roundNumber, round.score]), [
    ["A Main1, Player", 1, 62],
    ["A Main2, Player", 1, 66],
    ["A Main3, Player", 1, 67],
    ["A Main4, Player", 1, 68]
  ]);
});

test("B4R4 ties are broken by the next best golfer round", () => {
  const a = pick("A", { 1: [67], 2: [68], 3: [69], 4: [70], 5: [71], 6: [80], 7: [81] });
  const b = pick("B", { 1: [67], 2: [68], 3: [69], 4: [70], 5: [72], 6: [73], 7: [74] });
  const rows = buildB4R4Leaderboard([b.row, a.row], [...b.players, ...a.players], 1, 70);

  assert.deepEqual(rows.map((row) => [row.contestant, row.total, row.tieBreakRound?.score, row.rank]), [
    ["A", 274, 71, 1],
    ["B", 274, 72, 2]
  ]);
});

test("not-started rounds do not count toward B4R4 standings", () => {
  const team = pick("Waiting", {
    1: [67],
    2: [68],
    3: [69],
    4: [70],
    5: [71],
    6: [72],
    7: [73]
  });
  team.players.forEach((player) => {
    player.rounds[2] = { strokes: null, toPar: 0, holes: 0, status: "not_started" };
  });

  const [row] = buildB4R4Leaderboard([team.row], team.players, 2, 70);

  assert.equal(row.total, 274);
  assert.equal(row.countedRounds.every((round) => round.roundNumber === 1), true);
});

test("Alt B4R4 takes best four rounds from four different alternates", () => {
  const team = pick("ALT", {}, {
    1: [63, 64, 65, 66],
    2: [67],
    3: [68],
    4: [69],
    5: [70]
  });
  const [row] = buildAltB4R4Leaderboard([team.row], team.players, 4, 70);

  assert.equal(row.total, 267);
  assert.deepEqual(row.countedRounds.map((round) => [round.pickName, round.roundNumber, round.score]), [
    ["ALT Alt1, Player", 1, 63],
    ["ALT Alt2, Player", 1, 67],
    ["ALT Alt3, Player", 1, 68],
    ["ALT Alt4, Player", 1, 69]
  ]);
});

test("MAC picks include 25 teams with 7 main golfers and 5 alternates", () => {
  const rows = parsePicksCsv(readFileSync(new URL("../public/data/mac-picks.csv", import.meta.url), "utf8"));
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map((row) => row.Contestant)).size, 25);
  for (const row of rows) {
    assert.equal(new Set(Array.from({ length: MAIN_COUNT }, (_, index) => row[`Golfer ${index + 1}`])).size, MAIN_COUNT);
    assert.equal(new Set(Array.from({ length: ALT_COUNT }, (_, index) => row[`Alt ${index + 1}`])).size, ALT_COUNT);
  }
});

test("Aroni picks include 29 teams with 7 main golfers and 5 alternates", () => {
  const rows = parsePicksCsv(readFileSync(new URL("../public/data/aroni-picks.csv", import.meta.url), "utf8"));
  assert.equal(rows.length, 29);
  assert.equal(new Set(rows.map((row) => row.Contestant)).size, 29);
  for (const row of rows) {
    assert.equal(new Set(Array.from({ length: MAIN_COUNT }, (_, index) => row[`Golfer ${index + 1}`])).size, MAIN_COUNT);
    assert.equal(new Set(Array.from({ length: ALT_COUNT }, (_, index) => row[`Alt ${index + 1}`])).size, ALT_COUNT);
  }
});
