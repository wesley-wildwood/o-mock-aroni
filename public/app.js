import {
  buildAltB4R4Leaderboard,
  buildB4R4Leaderboard,
  parsePicksCsv
} from "./scoring.js";

const CONTEST_CONFIG = {
  mac: {
    label: "MAC",
    file: "/data/mac-picks.csv"
  },
  aroni: {
    label: "Aroni",
    file: "/data/aroni-picks.csv"
  }
};

const GAME_CONFIG = {
  glance: {
    label: "At-a-Glance",
    kicker: "Contest overview",
    totalHeader: "Total",
    roundHeader: "Next best",
    golferHeader: "Overview"
  },
  b4r4: {
    label: "B4R4",
    kicker: "Best four from four golfers",
    totalHeader: "Best 4 total",
    roundHeader: "Next best",
    golferHeader: "7 golfers",
    build: buildB4R4Leaderboard
  },
  altb4r4: {
    label: "Alt B4R4",
    kicker: "Alternate best four from four golfers",
    totalHeader: "Alt total",
    roundHeader: "Next best",
    golferHeader: "5 alternates",
    build: buildAltB4R4Leaderboard
  }
};

const state = { picksByContest: {}, live: null, selectedContest: "mac", selectedGame: "glance", selectedRound: 1, query: "" };
const elements = {
  leaderboard: document.querySelector("#leaderboard"),
  contestTabs: document.querySelector("#contestTabs"),
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
  search: document.querySelector("#searchInput"),
  heroTitle: document.querySelector("#heroTitle"),
  heroCopy: document.querySelector("#heroCopy")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function tournamentScore(value) {
  if (value == null) return "—";
  return value === 0 ? "E" : value > 0 ? `+${value}` : String(value);
}

function relativeScore(value, par = state.live?.event?.par || 70) {
  if (value == null) return "—";
  const difference = value - par;
  return difference === 0 ? "E" : difference > 0 ? `+${difference}` : String(difference);
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
  const rounds = golfer.rounds.map((round) => `<div class="round-chip ${round.counting ? "counting" : ""} ${round.tieBreaking ? "tiebreak" : ""} ${round.state === "missed_cut" || round.state === "withdrawn" ? "inactive" : ""}">
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

function currentPicks() {
  return state.picksByContest[state.selectedContest] || [];
}

function currentRows() {
  const config = GAME_CONFIG[state.selectedGame];
  if (!config.build) return [];
  return config.build(currentPicks(), state.live.players, state.selectedRound, state.live.event.par);
}

function rowsForGame(gameKey) {
  const config = GAME_CONFIG[gameKey];
  return config.build(currentPicks(), state.live.players, state.selectedRound, state.live.event.par);
}

function renderSummary(rows) {
  const leaderRows = state.selectedGame === "glance" ? rowsForGame("b4r4") : rows;
  const leader = leaderRows[0];
  const config = GAME_CONFIG[state.selectedGame];
  const picks = currentPicks();
  const onCourse = state.live.players.filter((player) => player.rounds?.[state.selectedRound]?.status === "playing").length;
  const completed = state.live.players.filter((player) => player.rounds?.[state.selectedRound]?.status === "complete").length;

  elements.summary.innerHTML = `
    <article class="summary-feature"><span>Current ${CONTEST_CONFIG[state.selectedContest].label} ${config.label === "At-a-Glance" ? "B4R4" : config.label} leader</span><strong>${escapeHtml(leader?.contestant || "—")}</strong><small>${leader?.toPar == null ? "No score" : tournamentScore(leader.toPar)} through R${state.selectedRound}</small></article>
    <article><span>Leading total</span><strong>${leader?.total ?? "—"}</strong><small>${leader?.countedRoundCount || 0} golfers counted</small></article>
    <article><span>On the course</span><strong>${onCourse}</strong><small>${completed} finished today</small></article>
    <article><span>Field</span><strong>${picks.length}</strong><small>Teams</small></article>`;
}

function configureView() {
  const contest = CONTEST_CONFIG[state.selectedContest];
  const config = GAME_CONFIG[state.selectedGame];
  const roundTitle = state.selectedRound === 4 ? "Final Round" : `Round ${state.selectedRound}`;
  elements.title.textContent = `${roundTitle} ${contest.label} ${config.label}${config.label === "At-a-Glance" ? "" : " leaderboard"}`;
  elements.kicker.textContent = config.kicker;
  elements.teamHeader.textContent = "Team";
  elements.cumulativeHeader.textContent = config.totalHeader;
  elements.roundHeader.textContent = config.roundHeader;
  elements.golfersHeader.textContent = config.golferHeader;
  elements.heroTitle.textContent = `${contest.label === "MAC" ? "The MAC" : contest.label} · Aug 20-23, 2026`;
  elements.heroCopy.textContent = `${currentPicks().length} teams · 7 golfers each · B4R4`;
}

function rowSubtitle(row) {
  const best = row.countedRounds.map((round) => `R${round.roundNumber} ${round.pickName} ${round.score}`).join(" · ") || "Waiting";
  const tiebreak = row.tieBreakRound ? `Next: R${row.tieBreakRound.roundNumber} ${row.tieBreakRound.pickName} ${row.tieBreakRound.score}` : "Next: waiting";
  return `Best: ${best} · ${tiebreak}`;
}

function primaryMeta(row) {
  return tournamentScore(row.toPar);
}

function secondaryValue(row) {
  return row.tieBreakRound?.score ?? "—";
}

function renderRows(rows) {
  const altPool = state.selectedGame === "altb4r4";
  return rows.map((row) => `<article class="leader-row pool-row ${row.rank <= 3 ? `top top-${row.rank}` : ""}">
    <div class="rank"><span>${row.rank}</span></div>
    <div class="contestant"><strong>${escapeHtml(row.contestant)}</strong><span>${escapeHtml(rowSubtitle(row))}</span></div>
    <div class="total"><strong>${row.total ?? "—"}</strong><span>${primaryMeta(row)}</span></div>
    <div class="round-score"><strong>${secondaryValue(row)}</strong><span>Next</span></div>
    <div class="golfers pool-golfers ${altPool ? "alt-pool" : ""}">${row.golfers.map(golferCard).join("")}</div>
  </article>`).join("");
}

function formatGlanceNext(row) {
  if (!row.tieBreakRound) return "Waiting";
  return `R${row.tieBreakRound.roundNumber} ${row.tieBreakRound.pickName} ${row.tieBreakRound.score}`;
}

function renderGlanceTable({ title, kicker, rows, accent }) {
  const visible = rows.slice(0, 15);
  return `<article class="glance-card ${accent}">
    <div class="glance-card-head">
      <div>
        <span>${escapeHtml(kicker)}</span>
        <strong>${escapeHtml(title)}</strong>
      </div>
      <small>Top ${visible.length}</small>
    </div>
    <div class="glance-table">
      <div class="glance-table-header"><span>Pos</span><span>Team</span><span>Total</span><span>Next</span></div>
      ${visible.map((row) => `<div class="glance-table-row">
        <span class="glance-rank">${row.rank}</span>
        <strong>${escapeHtml(row.contestant)}</strong>
        <span>${row.total ?? "—"} <small>${tournamentScore(row.toPar)}</small></span>
        <em>${escapeHtml(formatGlanceNext(row))}</em>
      </div>`).join("")}
    </div>
  </article>`;
}

function renderGlance() {
  const query = state.query.toLowerCase();
  const filterRows = (rows) => rows.filter((row) => !query || row.contestant.toLowerCase().includes(query));
  const roundTitle = state.selectedRound === 4 ? "Final Round" : `Round ${state.selectedRound}`;
  const b4r4Rows = filterRows(rowsForGame("b4r4"));
  const altRows = filterRows(rowsForGame("altb4r4"));
  if (!b4r4Rows.length && !altRows.length) {
    return '<div class="empty"><strong>No matches found</strong><span>Try a team name.</span></div>';
  }
  return `<div class="glance-grid">
    ${renderGlanceTable({ title: `${roundTitle} B4R4`, kicker: "Main game", rows: b4r4Rows, accent: "main-glance" })}
    ${renderGlanceTable({ title: `${roundTitle} Alt B4R4`, kicker: "Alternate game", rows: altRows, accent: "alt-glance" })}
  </div>`;
}

function render() {
  if (!state.live || !Object.keys(state.picksByContest).length) return;
  const rows = currentRows();
  const query = state.query.toLowerCase();
  const filtered = rows.filter((row) => !query || row.contestant.toLowerCase().includes(query) || row.golfers.some((golfer) => (
    golfer.pickName.toLowerCase().includes(query) || golfer.displayName.toLowerCase().includes(query)
  )));

  elements.contestTabs.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.contest === state.selectedContest;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.gameTabs.querySelectorAll("button").forEach((button) => {
    const active = button.dataset.game === state.selectedGame;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.tabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", Number(button.dataset.round) === state.selectedRound));
  configureView();
  document.body.dataset.contest = state.selectedContest;
  document.body.dataset.game = state.selectedGame;
  document.body.dataset.round = String(state.selectedRound);
  renderSummary(rows);

  if (state.selectedGame === "glance") {
    elements.leaderboard.innerHTML = renderGlance();
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

async function loadContestPicks() {
  const entries = await Promise.all(Object.entries(CONTEST_CONFIG).map(async ([key, contest]) => {
    const response = await fetch(contest.file);
    if (!response.ok) throw new Error(`${contest.label} picks file could not be loaded`);
    return [key, parsePicksCsv(await response.text())];
  }));
  state.picksByContest = Object.fromEntries(entries);
}

async function init() {
  await loadContestPicks();
  await refreshScores({ initial: true });
  window.setInterval(refreshScores, 60_000);
}

elements.contestTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-contest]");
  if (!button) return;
  state.selectedContest = button.dataset.contest;
  render();
});

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
