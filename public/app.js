import {
  buildARTLeaderboard,
  buildAltB4RLeaderboard,
  buildB4RLeaderboard,
  buildBROWLeaderboard,
  buildFlushLeaderboard,
  buildMTMCLeaderboard,
  buildSpreadLeaderboard,
  buildStraightLeaderboard,
  formatToPar,
  parsePicksCsv
} from "./scoring.js";

const GAME_CONFIG = {
  overview: {
    label: "Overview",
    kicker: "Top 15 across games",
    totalHeader: "Total",
    roundHeader: "Status",
    golferHeader: "Top 15",
    overview: true
  },
  b4r: {
    label: "B4R",
    kicker: "Best four rounds",
    totalHeader: "Best 4 total",
    roundHeader: "Rounds counted",
    golferHeader: "10 main golfers",
    build: buildB4RLeaderboard
  },
  brow: {
    label: "BROW",
    kicker: "Best round of week",
    totalHeader: "BROW total",
    roundHeader: "Golfers counted",
    golferHeader: "10 main golfers",
    build: buildBROWLeaderboard
  },
  art: {
    label: "ART",
    kicker: "After Round Two",
    totalHeader: "ART total",
    roundHeader: "Rounds counted",
    golferHeader: "10 main golfers",
    build: buildARTLeaderboard
  },
  altb4r: {
    label: "Alt B4R",
    kicker: "Alternate best four rounds",
    totalHeader: "Alt B4R total",
    roundHeader: "Next best",
    golferHeader: "6 alternates",
    build: buildAltB4RLeaderboard
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
  },
  mtmc: {
    label: "MTMC",
    kicker: "Most to make cut",
    totalHeader: "Made cut",
    roundHeader: "Status",
    golferHeader: "10 main golfers",
    build: buildMTMCLeaderboard
  },
  spread: {
    label: "Spread",
    kicker: "Best-to-worst range",
    totalHeader: "Spread",
    roundHeader: "Rounds used",
    golferHeader: "10 main golfers",
    build: buildSpreadLeaderboard
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
  const replacement = golfer.replacement ? `<span class="replacement-label">Alt for ${escapeHtml(golfer.replacementFor)}</span>` : "";
  const rounds = golfer.rounds.map((round) => `<div class="round-chip ${round.counting ? "counting" : ""} ${round.tieBreaking ? "tiebreak" : ""} ${round.state === "missed_cut" || round.state === "withdrawn" ? "inactive" : ""}">
    <span>R${round.roundNumber}</span>
    <strong>${displayRoundScore(round)}</strong>
    <small>${golferStatus(round)}</small>
  </div>`).join("");
  return `<div class="pool-golfer ${inactive ? "inactive" : ""}">
    <div class="pool-golfer-top">
      <span class="golfer-name">${escapeHtml(golfer.pickName)}</span>
      ${inactive ? `<span class="inactive-label">${inactiveLabel}</span>` : ""}
      ${replacement}
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

  if (state.selectedGame === "overview") {
    const games = overviewGameEntries();
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Overview</span><strong>${games.length}</strong><small>Games and subgames</small></article>
      <article><span>Top slots</span><strong>15</strong><small>Per board</small></article>
      <article><span>On the course</span><strong>${onCourse}</strong><small>${completed} finished today</small></article>
      <article><span>Field</span><strong>${state.picks.length}</strong><small>Teams</small></article>`;
    return;
  }

  if (state.selectedGame === "straight") {
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Current leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.runScores?.join("–") || "No string yet"}</small></article>
      <article><span>Longest string</span><strong>${leader?.length ?? "—"}</strong><small>Consecutive scores</small></article>
      <article><span>Starting score</span><strong>${Number.isFinite(leader?.startScore) ? leader.startScore : "—"}</strong><small>Current tie-break</small></article>
      <article><span>Eligible rounds</span><strong>${state.selectedRound * 10}</strong><small>10 main golfers through R${state.selectedRound}</small></article>`;
    return;
  }

  if (state.selectedGame === "flush") {
    const nextGroup = leader?.groups?.[1] ? `${leader.groups[1].count} × ${leader.groups[1].score}` : "—";
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Current leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.flushScore == null ? "No flush yet" : `${leader.flushCount} × ${leader.flushScore}`}</small></article>
      <article><span>Largest flush</span><strong>${leader?.flushCount ?? "—"}</strong><small>Matching scores</small></article>
      <article><span>Next flush group</span><strong>${nextGroup}</strong><small>Current tie-break</small></article>
      <article><span>Eligible rounds</span><strong>${state.selectedRound * 10}</strong><small>10 main golfers through R${state.selectedRound}</small></article>`;
    return;
  }

  if (state.selectedGame === "mtmc") {
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Current leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.total ?? 0} of 10 made cut</small></article>
      <article><span>Leading total</span><strong>${leader?.total ?? "—"}</strong><small>Players through cut</small></article>
      <article><span>Cut line</span><strong>${state.live.event.cutLine == null ? "—" : tournamentScore(state.live.event.cutLine)}</strong><small>After Round 2</small></article>
      <article><span>Field</span><strong>${fieldSize}</strong><small>Teams</small></article>`;
    return;
  }

  if (state.selectedGame === "spread") {
    elements.summary.innerHTML = `
      <article class="summary-feature"><span>Current leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.total == null ? "No rounds yet" : `${leader.total} stroke spread`}</small></article>
      <article><span>Leading spread</span><strong>${leader?.total ?? "—"}</strong><small>Best to worst round</small></article>
      <article><span>Rounds used</span><strong>${leader?.countedRoundCount ?? 0}</strong><small>Posted main-golfer rounds</small></article>
      <article><span>Field</span><strong>${fieldSize}</strong><small>Teams</small></article>`;
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
  elements.title.textContent = config.overview ? `${roundTitle} game overview` : `${roundTitle} ${config.label} leaderboard`;
  elements.kicker.textContent = config.kicker;
  elements.teamHeader.textContent = "Team";
  elements.cumulativeHeader.textContent = config.totalHeader;
  elements.roundHeader.textContent = config.roundHeader;
  elements.golfersHeader.textContent = config.golferHeader;
}

function rowSubtitle(row) {
  if (state.selectedGame === "b4r") {
    const best = row.countedRounds.map((round) => `R${round.roundNumber} ${round.pickName} ${round.score}`).join(" · ") || "Waiting";
    const tiebreak = row.tieBreakRound ? `Next: R${row.tieBreakRound.roundNumber} ${row.tieBreakRound.pickName} ${row.tieBreakRound.score}` : "Next: waiting";
    return `Best: ${best} · ${tiebreak}`;
  }
  if (state.selectedGame === "brow") return `${row.countedRoundCount}/10 golfers have a best round · BROW2 ${row.tieBreakTotal ?? "waiting"}`;
  if (state.selectedGame === "art") return `Rounds 1-${row.throughRound} across 10 golfers`;
  if (state.selectedGame === "altb4r") {
    const best = row.countedRounds.map((round) => `R${round.roundNumber} ${round.pickName} ${round.score}`).join(" · ") || "Waiting";
    const tiebreak = row.tieBreakRound ? `Next: R${row.tieBreakRound.roundNumber} ${row.tieBreakRound.pickName} ${row.tieBreakRound.score}` : "Next: waiting";
    return `Best: ${best} · ${tiebreak}`;
  }
  if (state.selectedGame === "straight") return row.runScores?.length ? row.runScores.join("–") : "No string yet";
  if (state.selectedGame === "flush") return row.flushScore == null ? "No flush yet" : `${row.flushCount} rounds of ${row.flushScore}`;
  if (state.selectedGame === "mtmc") return `${row.total ?? 0} of 10 main golfers made the cut`;
  if (state.selectedGame === "spread") {
    if (row.total == null) return "Waiting";
    return `Best ${row.bestRound?.score ?? "—"} · Worst ${row.worstRound?.score ?? "—"}`;
  }
  return "";
}

function primaryValue(row) {
  if (state.selectedGame === "straight") return row.length;
  if (state.selectedGame === "flush") return row.flushCount;
  if (state.selectedGame === "mtmc") return row.total == null ? "—" : `${row.total}/10`;
  return row.total ?? "—";
}

function primaryMeta(row) {
  if (state.selectedGame === "straight") return row.runScores?.join("–") || "—";
  if (state.selectedGame === "flush") return row.flushScore == null ? "—" : `${row.flushScore}s`;
  if (state.selectedGame === "mtmc") return "Made cut";
  if (state.selectedGame === "spread") return "Strokes";
  return tournamentScore(row.toPar);
}

function secondaryValue(row) {
  if (state.selectedGame === "straight") return Number.isFinite(row.startScore) ? row.startScore : "—";
  if (state.selectedGame === "flush") return row.flushScore ?? "—";
  if (state.selectedGame === "b4r" && state.selectedRound > 1) return row.tieBreakRound?.score ?? "—";
  if (state.selectedGame === "brow") return row.tieBreakTotal ?? "—";
  if (state.selectedGame === "mtmc") return state.selectedRound >= 3 ? "Final" : "Pending";
  if (state.selectedGame === "spread") return row.countedRoundCount ?? 0;
  return `${row.countedRoundCount || 0}`;
}

function secondaryMeta() {
  if (state.selectedGame === "straight") return "Start";
  if (state.selectedGame === "flush") return "Score";
  if (state.selectedGame === "b4r" && state.selectedRound > 1) return "Next";
  if (state.selectedGame === "brow") return "BROW2";
  if (state.selectedGame === "mtmc") return "Cut";
  if (state.selectedGame === "spread") return "Rounds";
  return "Rounds";
}

function renderRows(rows) {
  return rows.map((row) => `<article class="leader-row pool-row ${row.rank <= 3 ? `top top-${row.rank}` : ""}">
    <div class="rank"><span>${row.rank}</span></div>
    <div class="contestant"><strong>${escapeHtml(row.contestant)}</strong><span>${escapeHtml(rowSubtitle(row))}</span></div>
    <div class="total"><strong>${primaryValue(row)}</strong><span>${primaryMeta(row)}</span></div>
    <div class="round-score"><strong>${secondaryValue(row)}</strong><span>${secondaryMeta()}</span></div>
    <div class="golfers pool-golfers ${state.selectedGame === "altb4r" ? "alt-pool" : ""}">${row.golfers.map(golferCard).join("")}</div>
  </article>`).join("");
}

function overviewGameEntries() {
  return Object.entries(GAME_CONFIG).filter(([, config]) => !config.overview);
}

function overviewTotal(row, gameKey) {
  if (gameKey === "mtmc") return row.total == null ? "—" : `${row.total}/10`;
  return row.total ?? row.length ?? row.flushCount ?? "—";
}

function overviewStatus(row, gameKey) {
  if (gameKey === "straight") return row.runScores?.join("–") || "—";
  if (gameKey === "flush") return row.flushScore == null ? "—" : `${row.flushScore}s`;
  if (gameKey === "mtmc") return state.selectedRound >= 3 ? "Cut" : "Pending";
  if (gameKey === "spread") return row.total == null ? "Waiting" : `${row.bestRound?.score ?? "—"}-${row.worstRound?.score ?? "—"}`;
  const currentRounds = row.golfers?.flatMap((golfer) => golfer.rounds.filter((round) => round.roundNumber === state.selectedRound)) || [];
  if (currentRounds.some((round) => round.state === "playing")) return "Live";
  if (currentRounds.length && currentRounds.every((round) => ["complete", "missed_cut", "withdrawn"].includes(round.state))) return "F";
  return "Pending";
}

function renderOverview() {
  const query = state.query.toLowerCase();
  const cards = overviewGameEntries().map(([gameKey, config]) => {
    const rows = config.build(state.picks, state.live.players, state.selectedRound, state.live.event.par)
      .filter((row) => !query || row.contestant.toLowerCase().includes(query))
      .slice(0, 15);
    const body = rows.length ? rows.map((row) => `
      <tr>
        <td>${row.rank}</td>
        <td>${escapeHtml(row.contestant)}</td>
        <td>${overviewTotal(row, gameKey)}</td>
        <td>${escapeHtml(overviewStatus(row, gameKey))}</td>
      </tr>`).join("") : `<tr><td colspan="4">No matches</td></tr>`;
    return `<section class="overview-card">
      <header>${escapeHtml(config.label)}</header>
      <table>
        <thead><tr><th>Pos</th><th>Team</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
  }).join("");
  elements.leaderboard.innerHTML = `<div class="overview-grid">${cards}</div>`;
}

function render() {
  if (!state.live || !state.picks.length) return;
  const config = GAME_CONFIG[state.selectedGame];
  const rows = config.overview ? [] : config.build(state.picks, state.live.players, state.selectedRound, state.live.event.par);
  const query = state.query.toLowerCase();
  const filtered = config.overview ? [] : rows.filter((row) => !query || row.contestant.toLowerCase().includes(query) || row.golfers.some((golfer) => (
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
  document.body.dataset.round = String(state.selectedRound);
  document.body.classList.toggle("hide-round-count", state.selectedGame === "b4r" && state.selectedRound > 1);
  document.body.classList.toggle("overview-view", config.overview);
  renderSummary(rows);

  if (config.overview) {
    renderOverview();
    return;
  }

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
  const response = await fetch("/data/omoroney-picks.csv");
  if (!response.ok) throw new Error("The O'Moroney picks file could not be loaded");
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
elements.search.addEventListener("keyup", (event) => {
  state.query = event.target.value.trim();
  render();
});
elements.search.addEventListener("search", (event) => {
  state.query = event.target.value.trim();
  render();
});

init().catch((error) => {
  elements.leaderboard.innerHTML = `<div class="empty error"><strong>Couldn’t load the picks</strong><span>${escapeHtml(error.message)}</span></div>`;
});
