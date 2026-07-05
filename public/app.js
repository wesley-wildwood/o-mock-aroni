import {
  buildARTLeaderboard,
  buildAltBRODLeaderboard,
  buildB4RLeaderboard,
  buildBROWLeaderboard,
  buildFlushLeaderboard,
  buildStraightLeaderboard,
  formatToPar,
  parsePicksCsv
} from "./scoring.js";

const GAME_CONFIG = {
  b4r: {
    label: "B4R",
    kicker: "Best four rounds",
    totalHeader: "Best 4 total",
    roundHeader: "Rounds counted",
    golferHeader: "8 main golfers",
    build: buildB4RLeaderboard
  },
  brow: {
    label: "BROW",
    kicker: "Best round of week",
    totalHeader: "BROW total",
    roundHeader: "Golfers counted",
    golferHeader: "8 main golfers",
    build: buildBROWLeaderboard
  },
  art: {
    label: "ART",
    kicker: "After Round Two",
    totalHeader: "ART total",
    roundHeader: "Rounds counted",
    golferHeader: "8 main golfers",
    build: buildARTLeaderboard
  },
  altbrod: {
    label: "Alt BROD",
    kicker: "Alternate best round of day",
    totalHeader: "Alt BROD total",
    roundHeader: "Daily bests",
    golferHeader: "4 alternates",
    build: buildAltBRODLeaderboard
  },
  straight: {
    label: "Straight",
    kicker: "Consecutive scores",
    totalHeader: "String length",
    roundHeader: "Starting score",
    golferHeader: "Main golfer rounds",
    build: buildStraightLeaderboard,
    award: true
  },
  flush: {
    label: "Flush",
    kicker: "Matching scores",
    totalHeader: "Flush size",
    roundHeader: "Flush score",
    golferHeader: "Main golfer rounds",
    build: buildFlushLeaderboard,
    award: true
  }
};

const state = { picks: [], live: null, selectedGame: "b4r", selectedRound: 1, query: "" };
const elements = {
  leaderboard: document.querySelector("#leaderboard"),
  gameTabs: document.querySelector("#gameTabs"),
  tabs: document.querySelector("#roundTabs"),
  summary: document.querySelector("#summary"),
  status: document.querySelector("#liveStatus"),
  updated: document.querySelector("#updatedAt"),
  title: document.querySelector("#boardTitle"),
  kicker: document.querySelector("#boardKicker"),
  teamHeader: document.querySelector("#teamHeader"),
  cumulativeHeader: document.querySelector("#cumulativeHeader"),
  roundHeader: document.querySelector("#roundHeader"),
  golfersHeader: document.querySelector("#golfersHeader"),
  search: document.querySelector("#searchInput")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function relativeScore(value, par = state.live?.event?.par || 71) {
  if (value == null) return "—";
  const difference = value - par;
  return difference === 0 ? "E" : difference > 0 ? `+${difference}` : String(difference);
}

function tournamentScore(value) {
  if (value == null) return "—";
  return value === 0 ? "E" : value > 0 ? `+${value}` : String(value);
}

function golferStatus(round) {
  if (round.state === "missed_cut") return "MC";
  if (round.state === "withdrawn") return "WD";
  if (round.state === "unavailable") return "No feed";
  if (!round.round || round.state === "not_started") {
    if (round.round?.teeTime) return new Date(round.round.teeTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return "NS";
  }
  if (round.state === "complete") return "F";
  return `Thru ${round.round.holes}`;
}

function displayRoundScore(round) {
  if (round.state === "missed_cut") return "MC";
  if (round.state === "withdrawn") return "WD";
  return relativeScore(round.score);
}

function golferCard(golfer) {
  const inactive = golfer.player?.status === "missed_cut" || golfer.player?.status === "withdrawn";
  const inactiveLabel = golfer.player?.status === "withdrawn" ? "WD" : "MC";
  const rounds = golfer.rounds.map((round) => `<div class="round-chip ${round.counting ? "counting" : ""} ${round.state === "missed_cut" || round.state === "withdrawn" ? "inactive" : ""}">
    <span>R${round.roundNumber}</span>
    <strong>${displayRoundScore(round)}</strong>
    <small>${golferStatus(round)}</small>
  </div>`).join("");
  return `<div class="pool-golfer ${inactive ? "inactive" : ""}">
    <div class="pool-golfer-top">
      <span class="golfer-name">${escapeHtml(golfer.pickName)}</span>
      ${inactive ? `<span class="inactive-label">${inactiveLabel}</span>` : ""}
      <span class="alt-total">Total ${tournamentScore(golfer.player?.tournamentToPar)}</span>
    </div>
    <div class="round-chips">${rounds}</div>
  </div>`;
}

function renderSummary(rows) {
  const leader = rows[0];
  const config = GAME_CONFIG[state.selectedGame];
  const onCourse = state.live.players.filter((player) => player.rounds?.[state.selectedRound]?.status === "playing").length;
  const completed = state.live.players.filter((player) => player.rounds?.[state.selectedRound]?.status === "complete").length;
  const fieldSize = rows.length;

  if (state.selectedGame === "straight") {
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Current leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.runScores?.join("–") || "No string yet"}</small></article>
      <article><span>Longest string</span><strong>${leader?.length ?? "—"}</strong><small>Consecutive scores</small></article>
      <article><span>Starting score</span><strong>${Number.isFinite(leader?.startScore) ? leader.startScore : "—"}</strong><small>Current tie-break</small></article>
      <article><span>Eligible rounds</span><strong>${state.selectedRound * 8}</strong><small>8 main golfers through R${state.selectedRound}</small></article>`;
    return;
  }

  if (state.selectedGame === "flush") {
    const nextGroup = leader?.groups?.[1] ? `${leader.groups[1].count} × ${leader.groups[1].score}` : "—";
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Current leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.flushScore == null ? "No flush yet" : `${leader.flushCount} × ${leader.flushScore}`}</small></article>
      <article><span>Largest flush</span><strong>${leader?.flushCount ?? "—"}</strong><small>Matching scores</small></article>
      <article><span>Next flush group</span><strong>${nextGroup}</strong><small>Current tie-break</small></article>
      <article><span>Eligible rounds</span><strong>${state.selectedRound * 8}</strong><small>8 main golfers through R${state.selectedRound}</small></article>`;
    return;
  }

  elements.summary.innerHTML = `
    <article class="summary-feature"><span>Current ${config.label} leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.toPar == null ? "No score" : tournamentScore(leader.toPar)} through R${state.selectedRound}</small></article>
    <article><span>Leading total</span><strong>${leader?.total ?? "—"}</strong><small>${leader?.countedRoundCount || 0} rounds counted</small></article>
    <article><span>On the course</span><strong>${onCourse}</strong><small>${completed} finished today</small></article>
    <article><span>Field</span><strong>${fieldSize}</strong><small>Teams</small></article>`;
}

function configureView() {
  const config = GAME_CONFIG[state.selectedGame];
  const roundTitle = state.selectedRound === 4 ? "Final Round" : `Round ${state.selectedRound}`;
  elements.title.textContent = `${roundTitle} ${config.label} leaderboard`;
  elements.kicker.textContent = config.kicker;
  elements.teamHeader.textContent = "Team";
  elements.cumulativeHeader.textContent = config.totalHeader;
  elements.roundHeader.textContent = config.roundHeader;
  elements.golfersHeader.textContent = config.golferHeader;
}

function rowSubtitle(row) {
  if (state.selectedGame === "b4r") return `Best rounds: ${row.countedRounds.map((round) => `R${round.roundNumber} ${round.pickName} ${round.score}`).join(" · ") || "Waiting"}`;
  if (state.selectedGame === "brow") return `${row.countedRoundCount}/8 golfers have a best round`;
  if (state.selectedGame === "art") return `Rounds 1-${row.throughRound} across 8 golfers`;
  if (state.selectedGame === "altbrod") return row.countedRounds.map((round) => `R${round.roundNumber} ${round.pickName} ${round.score}`).join(" · ") || "Waiting";
  if (state.selectedGame === "straight") return row.runScores?.length ? row.runScores.join("–") : "No string yet";
  if (state.selectedGame === "flush") return row.flushScore == null ? "No flush yet" : `${row.flushCount} rounds of ${row.flushScore}`;
  return "";
}

function primaryValue(row) {
  if (state.selectedGame === "straight") return row.length;
  if (state.selectedGame === "flush") return row.flushCount;
  return row.total ?? "—";
}

function primaryMeta(row) {
  if (state.selectedGame === "straight") return row.runScores?.join("–") || "—";
  if (state.selectedGame === "flush") return row.flushScore == null ? "—" : `${row.flushScore}s`;
  return tournamentScore(row.toPar);
}

function secondaryValue(row) {
  if (state.selectedGame === "straight") return Number.isFinite(row.startScore) ? row.startScore : "—";
  if (state.selectedGame === "flush") return row.flushScore ?? "—";
  return `${row.countedRoundCount || 0}`;
}

function secondaryMeta() {
  if (state.selectedGame === "straight") return "Start";
  if (state.selectedGame === "flush") return "Score";
  return "Rounds";
}

function renderRows(rows) {
  return rows.map((row) => `<article class="leader-row pool-row ${row.rank <= 3 ? `top top-${row.rank}` : ""}">
    <div class="rank"><span>${row.rank}</span></div>
    <div class="contestant"><strong>${escapeHtml(row.contestant)}</strong><span>${escapeHtml(rowSubtitle(row))}</span></div>
    <div class="total"><strong>${primaryValue(row)}</strong><span>${primaryMeta(row)}</span></div>
    <div class="round-score"><strong>${secondaryValue(row)}</strong><span>${secondaryMeta()}</span></div>
    <div class="golfers pool-golfers ${state.selectedGame === "altbrod" ? "alt-pool" : ""}">${row.golfers.map(golferCard).join("")}</div>
  </article>`).join("");
}

function render() {
  if (!state.live || !state.picks.length) return;
  const config = GAME_CONFIG[state.selectedGame];
  const rows = config.build(state.picks, state.live.players, state.selectedRound, state.live.event.par);
  const query = state.query.toLowerCase();
  const filtered = rows.filter((row) => !query || row.contestant.toLowerCase().includes(query) || row.golfers.some((golfer) => (
    golfer.pickName.toLowerCase().includes(query) || golfer.displayName.toLowerCase().includes(query)
  )));

  elements.gameTabs.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.game === state.selectedGame;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.tabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", Number(button.dataset.round) === state.selectedRound));
  configureView();
  document.body.dataset.game = state.selectedGame;
  renderSummary(rows);

  if (!filtered.length) {
    elements.leaderboard.innerHTML = '<div class="empty"><strong>No matches found</strong><span>Try a team or golfer’s last name.</span></div>';
    return;
  }

  elements.leaderboard.innerHTML = renderRows(filtered);
}

async function refreshScores({ initial = false } = {}) {
  try {
    const response = await fetch("/api/scores", { cache: "no-store" });
    if (!response.ok) throw new Error(`Score service returned ${response.status}`);
    state.live = await response.json();
    if (initial) state.selectedRound = Math.min(4, Math.max(1, state.live.event.currentRound || 1));
    elements.status.innerHTML = `<span></span> ${escapeHtml(state.live.event.statusDetail || state.live.event.status)}`;
    elements.status.classList.add("connected");
    elements.updated.textContent = `Updated ${new Date(state.live.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    render();
  } catch (error) {
    elements.status.innerHTML = "<span></span> Scores delayed";
    elements.status.classList.remove("connected");
    if (!state.live) elements.leaderboard.innerHTML = `<div class="empty error"><strong>Live scores are taking a breather</strong><span>${escapeHtml(error.message)}. We’ll try again automatically.</span></div>`;
  }
}

async function init() {
  const response = await fetch("/data/john-deere-picks.csv");
  if (!response.ok) throw new Error("The John Deere picks file could not be loaded");
  state.picks = parsePicksCsv(await response.text());
  await refreshScores({ initial: true });
  window.setInterval(refreshScores, 60_000);
}

elements.gameTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-game]");
  if (!button) return;
  state.selectedGame = button.dataset.game;
  render();
});

elements.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-round]");
  if (!button) return;
  state.selectedRound = Number(button.dataset.round);
  render();
});

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

init().catch((error) => {
  elements.leaderboard.innerHTML = `<div class="empty error"><strong>Couldn’t load the picks</strong><span>${escapeHtml(error.message)}</span></div>`;
});
