import React, { useMemo, useRef, useState, useLayoutEffect } from "react";

// game helpers
type Cell = "X" | "O" | null;
type Board = Cell[];   // length 9
type Outcome = "X" | "O" | "D";   // D = draw/tie

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function checkWinner(board: Board): Outcome | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Outcome;
    }
  }
  if (board.every(Boolean)) return "D";
  return null;
}
function legalMoves(board: Board): number[] {
  const m: number[] = [];
  board.forEach((c, i) => !c && m.push(i));
  return m;
}
function nextPlayer(board: Board): "X" | "O" {
  const x = board.filter((c) => c === "X").length;
  const o = board.filter((c) => c === "O").length;
  return x === o ? "X" : "O";
}
function indexToCoord(i: number) {
  const r = Math.floor(i / 3) + 1;
  const c = (i % 3) + 1;
  return `(${r},${c})`;
}
function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// seeded RNG using Mulberry32
type RNG = () => number;
function createMulberry32(seed: number): RNG {
  let t = (seed >>> 0) || 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function randChoice<T>(arr: T[], rand: RNG): T {
  return arr[Math.floor(rand() * arr.length)];
}

type Node = {
  board: Board;
  toMove: "X" | "O";
  parent?: Node;
  moveFromParent: number | null;
  children: Map<number, Node>;
  untried: number[];
  N: number;    // visits
  W: number;    // total reward from root player's perspective
  wins: number;
  draws: number;
  losses: number;
  terminal: Outcome | null;
};

function makeNode(board: Board, toMove: "X" | "O", parent?: Node, moveFromParent: number | null = null): Node {
  return {
    board,
    toMove,
    parent,
    moveFromParent,
    children: new Map(),
    untried: legalMoves(board),
    N: 0,
    W: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    terminal: checkWinner(board),
  };
}

function uctValue(parentN: number, child: Node, C: number) {
  const q = child.N > 0 ? child.W / child.N : 0;
  const u = C * Math.sqrt(Math.log(parentN + 1) / (child.N + 1));
  return q + u;
}

function select(node: Node, C: number, rand: RNG): Node {
  while (node.terminal === null && node.untried.length === 0 && node.children.size > 0) {
    let best: Node | null = null;
    let bestVal = -Infinity;
    for (const child of node.children.values()) {
      const val = uctValue(node.N, child, C);
      if (val > bestVal || (Math.abs(val - bestVal) < 1e-12 && rand() < 0.5)) {
        bestVal = val;
        best = child;
      }
    }
    node = best!;
  }
  return node;
}

function expand(node: Node, rand: RNG): Node {
  if (node.terminal !== null || node.untried.length === 0) return node;
  const m = randChoice(node.untried, rand);
  node.untried = node.untried.filter((x) => x !== m);
  const b2 = node.board.slice();
  b2[m] = node.toMove;
  const child = makeNode(b2, node.toMove === "X" ? "O" : "X", node, m);
  node.children.set(m, child);
  return child;
}

function rewardFrom(outcome: Outcome, rootPlayer: "X" | "O") {
  if (outcome === "D") return 0.5;
  return outcome === rootPlayer ? 1 : 0;
}

function backprop(node: Node, outcome: Outcome, rootPlayer: "X" | "O") {
  let cur: Node | undefined = node;
  const r = rewardFrom(outcome, rootPlayer);
  while (cur) {
    cur.N += 1;
    cur.W += r;
    if (outcome === "D") cur.draws += 1;
    else if (outcome === rootPlayer) cur.wins += 1;
    else cur.losses += 1;
    cur = cur.parent;
  }
}

function rolloutWithTrace(board: Board, playerToMove: "X" | "O", rand: RNG) {
  const b = board.slice();
  let p = playerToMove;
  const trace: Array<{ idx: number; player: "X" | "O" }> = [];
  let winner = checkWinner(b);
  while (!winner) {
    const moves = legalMoves(b);
    if (moves.length === 0) return { outcome: "D" as Outcome, trace, final: b };
    const m = randChoice(moves, rand);
    b[m] = p;
    trace.push({ idx: m, player: p });
    p = p === "X" ? "O" : "X";
    winner = checkWinner(b);
  }
  return { outcome: winner, trace, final: b };
}



// presets
const PRESETS: { key: string; name: string; board: Board; note: string }[] = [
  { key: "empty", name: "Empty board", board: [null, null, null, null, null, null, null, null, null], note: "Start position." },
  { key: "midgame1", name: "Midgame (X to move)", board: ["X", "O", null, null, "X", null, "O", null, null], note: "Explore C." },
  { key: "endgame1", name: "Near endgame (X to move)", board: ["X", "O", "X", "O", "X", null, null, "O", null], note: "Small action set." },
  { key: "mustblock_pure", name: "Must block (X to move)", board: ["O", "O", null, null, "X", null, null, "X", null], note: "Block at (1,3)." },
];



// cell UI
function CellView({
  value,
  onClick,
  isBest,
  sel,
  exp,
  heat,
  count,
  ghost,
}: {
  value: Cell;
  onClick?: () => void;
  isBest?: boolean;
  sel?: boolean;
  exp?: boolean;
  heat?: number;
  count?: number;
  ghost?: "X" | "O" | null;
}) {
  const clamped = Math.max(0, Math.min(1, heat ?? 0));
  const alpha = clamped * 0.6;
  const barPct = Math.round(clamped * 100);

  return (
    <button
      onClick={onClick}
      className={classNames(
        "relative aspect-square w-20 sm:w-24 md:w-28 grid place-items-center text-2xl font-semibold rounded-2xl",
        "border border-gray-300 hover:shadow-md transition",
        isBest ? "ring-4 ring-violet-600 shadow-lg" : "",
        sel ? "ring-4 ring-sky-500" : "",
        exp ? "border-2 border-amber-500 border-dashed" : ""
      )}
    >
      {/* heatmap overlay */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ backgroundColor: `rgba(16,185,129,${alpha})` }} />
      {/* visit count */}
      {typeof count === "number" && count > 0 && (
        <div className="absolute top-1 left-2 text-[11px] font-semibold text-slate-800 bg-white/80 px-1.5 py-0.5 rounded-md border border-slate-200">
          {count}
        </div>
      )}
      {/* bottom visit bar */}
      {barPct > 0 && <div className="absolute left-0 bottom-0 h-1.5 rounded-br-2xl rounded-tr-2xl bg-emerald-600" style={{ width: `${barPct}%` }} />}
      {/* "best" badge */}
      {isBest && <div className="absolute top-1 right-2 text-[11px] font-semibold text-white bg-violet-600 px-1.5 py-0.5 rounded-md">Best</div>}
      {/* simulation ghost */}
      {ghost && value === null && <span className="absolute text-2xl sm:text-3xl font-bold text-slate-400/60">{ghost}</span>}

      <span className="relative z-10">{value ?? ""}</span>
    </button>
  );
}



// components
export default function MonteCarloTicTacToePart2() {
  const [presetKey, setPresetKey] = useState(PRESETS[0].key);
  const [board, setBoard] = useState<Board>(PRESETS[0].board);

  const [C, setC] = useState<number>(1);
  const [itersPerRun, setItersPerRun] = useState<number>(50);

  const [seed, setSeed] = useState<number>(42);
  const rngRef = useRef<RNG>(createMulberry32(seed));
  const reseedRng = (s: number) => { rngRef.current = createMulberry32(s >>> 0); };

  const [freshEachRun, setFreshEachRun] = useState<boolean>(true);

  const [root, setRoot] = useState<Node>(() => makeNode(PRESETS[0].board, nextPlayer(PRESETS[0].board)));
  const [isRunning, setIsRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  const currentPlayer = useMemo(() => nextPlayer(board), [board]);
  const terminal = useMemo(() => checkWinner(board), [board]);

  const [totalIters, setTotalIters] = useState<number>(0);

  // phase visualization
  type Phase = "idle" | "selection" | "expansion" | "simulation" | "backprop";
  const [phase, setPhase] = useState<Phase>("idle");
  const [selRootMove, setSelRootMove] = useState<number | null>(null);
  const [expRootMove, setExpRootMove] = useState<number | null>(null);
  const [simOverlay, setSimOverlay] = useState<Board>([null, null, null, null, null, null, null, null, null]);

  // animate every k-th iteration selector
  const [animateEvery, setAnimateEvery] = useState<string>("10");   // "1", "5", "10", "last"

  // layout syncing
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => { if (leftPanelRef.current) setLeftHeight(leftPanelRef.current.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [board, root, C, itersPerRun, terminal, phase]);

  // pause/cancel token
  const runTokenRef = useRef<{ paused: boolean; cancelled: boolean }>({ paused: false, cancelled: false });

  // pause that keeps track of sleep time (returns false if cancelled)
  const pauseStepMs = 60;
  async function pauseAwareSleep(ms: number): Promise<boolean> {
    const start = performance.now();
    while (performance.now() - start < ms) {
      if (runTokenRef.current.cancelled) return false;
      while (runTokenRef.current.paused && !runTokenRef.current.cancelled) {
        await new Promise((r) => setTimeout(r, pauseStepMs));
      }
      await new Promise((r) => setTimeout(r, pauseStepMs));
    }
    return !runTokenRef.current.cancelled;
  }
  async function waitIfPaused(): Promise<boolean> {
    while (runTokenRef.current.paused && !runTokenRef.current.cancelled) {
      await new Promise((r) => setTimeout(r, pauseStepMs));
    }
    return !runTokenRef.current.cancelled;
  }

  const clearVisuals = () => {
    setPhase("idle");
    setSelRootMove(null);
    setExpRootMove(null);
    setSimOverlay([null, null, null, null, null, null, null, null, null]);
  };

  const resetTreeToBoard = (b: Board) => {
    setRoot(makeNode(b, nextPlayer(b)));
    setTotalIters(0);
    clearVisuals();
  };

  const handlePreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key)!;
    setPresetKey(key);
    setBoard(p.board.slice());
    resetTreeToBoard(p.board.slice());
  };

  const placeMark = (i: number) => {
    if (terminal || board[i]) return;
    const b2 = board.slice();
    b2[i] = currentPlayer;
    setBoard(b2);
    resetTreeToBoard(b2);
  };

  // reset button handler
  const resetPosition = () => {
    if (isRunning) {
      runTokenRef.current.cancelled = true;
      runTokenRef.current.paused = false;
      setPaused(false);
      setIsRunning(false);
    }
    const p = PRESETS.find((x) => x.key === presetKey)!;
    setBoard(p.board.slice());
    resetTreeToBoard(p.board.slice());
  };

  const PAUSE = 450;
  const SIM_STEP_MS = 120;

  // handling each iteration
  async function oneIterationViz(workRoot: Node): Promise<{ root: Node; ok: boolean }> {
    setSelRootMove(null);
    setExpRootMove(null);
    setSimOverlay([null, null, null, null, null, null, null, null, null]);

    // selection
    setPhase("selection");
    let node: Node = workRoot;
    let chosenRootMove: number | null = null;
    while (node.terminal === null && node.untried.length === 0 && node.children.size > 0) {
      if (!(await waitIfPaused())) return { root: workRoot, ok: false };
      let best: Node | null = null;
      let bestVal = -Infinity;
      for (const child of node.children.values()) {
        const val = uctValue(node.N, child, C);
        if (val > bestVal || (Math.abs(val - bestVal) < 1e-12 && rngRef.current() < 0.5)) {
          bestVal = val;
          best = child;
        }
      }
      node = best!;
      if (node.parent === workRoot && node.moveFromParent !== null) chosenRootMove = node.moveFromParent;
    }
    if (chosenRootMove !== null) setSelRootMove(chosenRootMove);
    if (!(await pauseAwareSleep(PAUSE))) return { root: workRoot, ok: false };

    // expansion
    setPhase("expansion");
    if (node.terminal === null && node.untried.length > 0) {
      const m = randChoice(node.untried, rngRef.current);
      node.untried = node.untried.filter((x) => x !== m);
      const b2 = node.board.slice();
      b2[m] = node.toMove;
      const child = makeNode(b2, node.toMove === "X" ? "O" : "X", node, m);
      node.children.set(m, child);
      node = child;
      if (node.parent === workRoot && node.moveFromParent !== null) setExpRootMove(node.moveFromParent);
    }
    if (!(await pauseAwareSleep(PAUSE))) return { root: workRoot, ok: false };

    // simulation
    setPhase("simulation");
    const { outcome, trace } = rolloutWithTrace(node.board, node.toMove, rngRef.current);
    const overlay = [null, null, null, null, null, null, null, null, null] as Board;
    for (const step of trace) {
      if (!(await waitIfPaused())) return { root: workRoot, ok: false };
      if (runTokenRef.current.cancelled) return { root: workRoot, ok: false };
      if (board[step.idx] === null) {
        overlay[step.idx] = step.player;
        setSimOverlay(overlay.slice());
        if (!(await pauseAwareSleep(SIM_STEP_MS))) return { root: workRoot, ok: false };
      }
    }
    if (!(await pauseAwareSleep(PAUSE))) return { root: workRoot, ok: false };

    // backpropagation
    setPhase("backprop");
    backprop(node, outcome, nextPlayer(board));
    setRoot({ ...workRoot });
    if (!(await pauseAwareSleep(PAUSE))) return { root: workRoot, ok: false };

    // clear
    clearVisuals();
    return { root: workRoot, ok: true };
  }

  // single iteration option handler
  function oneIterationFast(workRoot: Node): Node {
    let node = select(workRoot, C, rngRef.current);
    if (node.terminal === null && node.untried.length > 0) node = expand(node, rngRef.current);
    const { outcome } = rolloutWithTrace(node.board, node.toMove, rngRef.current);
    backprop(node, outcome, nextPlayer(board));
    return workRoot;
  }

  // control helpers
  function startRun() {
    runTokenRef.current = { paused: false, cancelled: false };
    setPaused(false);
    setIsRunning(true);
  }
  function endRun() {
    setIsRunning(false);
    setPaused(false);
    clearVisuals();
  }

  const onPauseResume = () => {
    if (!isRunning) return;
    const next = !paused;
    runTokenRef.current.paused = next;
    setPaused(next);
  };

  const onCancel = () => {
    if (!isRunning) return;
    runTokenRef.current.cancelled = true;
    runTokenRef.current.paused = false;   // in case it was paused
    setPaused(false);
    clearVisuals();
    setIsRunning(false);
  };

  // single-step (animated)
  const stepOne = async () => {
    if (terminal || isRunning) return;
    startRun();
    reseedRng(seed);
    try {
      const { ok } = await oneIterationViz(root);
      if (ok) setTotalIters((t) => t + 1);
    } finally {
      endRun();
    }
  };

  // run batch (no animation)
  const runBatch = async (iters: number) => {
    if (terminal || isRunning) return;
    startRun();
    reseedRng(seed);
    try {
      let done = 0;
      for (let i = 0; i < iters; i++) {
        if (runTokenRef.current.cancelled) break;
        if (!(await waitIfPaused())) break;
        oneIterationFast(root);
        done++;
      }
      setRoot({ ...root });
      setTotalIters((t) => t + done);
    } finally {
      endRun();
    }
  };

  // run batch fresh (no animation)
  const runBatchFresh = async (iters: number) => {
    if (terminal || isRunning) return;
    startRun();
    reseedRng(seed);
    try {
      const freshRoot = makeNode(board.slice(), nextPlayer(board));
      let done = 0;
      for (let i = 0; i < iters; i++) {
        if (runTokenRef.current.cancelled) { setRoot(freshRoot); break; }
        if (!(await waitIfPaused())) { setRoot(freshRoot); break; }
        oneIterationFast(freshRoot);
        done++;
      }
      setRoot(freshRoot);
      setTotalIters((t) => t + done);
    } finally {
      endRun();
    }
  };

  // step N iters (animated periodically)
  const stepManyAnimated = async () => {
    if (terminal || isRunning) return;
    startRun();
    reseedRng(seed);

    const animateEveryN =
      animateEvery === "last" ? Number.POSITIVE_INFINITY : Math.max(1, parseInt(animateEvery || "10", 10));

    let workRoot = freshEachRun ? makeNode(board.slice(), nextPlayer(board)) : root;

    try {
      let done = 0;
      for (let i = 1; i <= itersPerRun; i++) {
        if (runTokenRef.current.cancelled) break;
        if (!(await waitIfPaused())) break;

        const shouldAnimate = i === 1 || i === itersPerRun || (i % animateEveryN === 0);
        if (shouldAnimate) {
          const { ok } = await oneIterationViz(workRoot);
          if (!ok) break;
          done++;
        } else {
          workRoot = oneIterationFast(workRoot);
          done++;
          if (i % 20 === 0 || i === itersPerRun) setRoot({ ...workRoot });
        }
      }
      setRoot(workRoot === root ? { ...root } : workRoot);
      setTotalIters((t) => t + done);
    } finally {
      endRun();
    }
  };

  const bestChildMove: number | null = useMemo(() => {
    if (root.children.size === 0) return null;
    let best: number | null = null;
    let bestN = -1;
    for (const [m, ch] of root.children.entries()) {
      if (ch.N > bestN) {
        bestN = ch.N;
        best = m;
      }
    }
    return best;
  }, [root]);

  const preset = PRESETS.find((p) => p.key === presetKey)!;

  const maxN = useMemo(() => {
    const arr = [...root.children.values()].map((c) => c.N);
    return arr.length ? Math.max(...arr) : 0;
  }, [root]);

  const phases: Array<{ key: Phase; label: string; color: string }> = [
    { key: "selection", label: "Selection", color: "bg-sky-500" },
    { key: "expansion", label: "Expansion", color: "bg-amber-500" },
    { key: "simulation", label: "Simulation", color: "bg-slate-600" },
    { key: "backprop", label: "Backpropagation", color: "bg-emerald-600" },
  ];
  const isActive = (k: Phase) => phase === k;

  return (
    <div className="w-full text-slate-800 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto grid gap-6 md:gap-8">

        {/* header */}
        <header>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Part 2 — Monte Carlo Tree Search (UCT)</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-700">
            <strong>What is UCT?</strong> UCT chooses which child to explore with
            <code> UCT = Q + C·√(ln N<sub>parent</sub> / (N<sub>child</sub>+1))</code>. The first term (<code>Q</code>) rewards moves that
            performed well; the second forces exploration. Each iteration does: <em>Selection</em>, <em>Expansion</em>, <em>Simulation</em>, <em>Backpropagation</em>.
          </p>

          {/* "how to use" box */}
          <section className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 text-violet-900 p-4 sm:p-5">
            <h3 className="text-base sm:text-lg font-semibold">How to use this demo</h3>
            <ol className="mt-2 list-decimal ml-5 text-sm sm:text-base space-y-1">
              <li>Pick a <span className="font-medium">preset</span> (X to move) and set a <span className="font-medium">Seed</span> (default: 42) for reproducible runs.</li>
              <li>Keep <span className="font-medium">Fresh run</span> ON for comparable runs; OFF to let the tree keep growing.</li>
              <li>Adjust <span className="font-medium">C</span> (0–10). Lower = exploit; higher = explore.</li>
              <li>Use <span className="font-medium">Step 1 iter</span> to watch the four phases; or
                <span className="font-medium"> Step N iters (animated)</span> to animate periodically while doing many iterations.</li>
              <li><span className="font-medium">Run N iters</span> builds evidence fast without animation. Green = more visits; violet ring = current best move.</li>
              <li>Use <span className="font-medium">Pause/Resume</span> or <span className="font-medium">Cancel</span> to stop a long run of animations.</li>
            </ol>
          </section>
        </header>

        <section className="grid md:grid-cols-3 gap-6 items-start">
          {/* left: board + controls */}
          <div ref={leftPanelRef} className="md:col-span-2 grid gap-4 p-4 rounded-2xl bg-white shadow-sm">

            {/* top controls: preset + seed/toggle + reset */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium">Preset:</label>
              <select
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                value={presetKey}
                onChange={(e) => handlePreset(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>

              <div className="flex items-center gap-4 ml-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="seed" className="text-sm text-slate-600">Randomness Seed:</label>
                  <input
                    id="seed"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number.isFinite(parseInt(e.target.value)) ? parseInt(e.target.value) : 0)}
                    className="w-28 px-2 py-1 border border-slate-300 rounded-lg"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={freshEachRun}
                    onChange={(e) => setFreshEachRun(e.target.checked)}
                  />
                  Fresh run
                </label>
              </div>

              {/* reset button (top-right of this control row) */}
              <button
                onClick={resetPosition}
                className="ml-auto px-3 py-1.5 rounded-lg bg-rose-500 text-white font-medium shadow hover:shadow-md hover:bg-rose-600"
              >
                Reset
              </button>
            </div>

            {/* buttons + animate-every row */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={stepOne}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={!!terminal || isRunning}
              >
                {isRunning ? "Running…" : "Step 1 iter"}
              </button>

              <button
                onClick={stepManyAnimated}
                className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white font-medium shadow hover:shadow-md hover:bg-indigo-600 disabled:opacity-50"
                disabled={(isRunning && !paused) || !!terminal}
              >
                {`Step ${itersPerRun} iters (animated)`}
              </button>

              <button
                onClick={() => (freshEachRun ? runBatchFresh(itersPerRun) : runBatch(itersPerRun))}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-medium shadow hover:shadow-md hover:bg-emerald-600 disabled:opacity-50"
                disabled={(isRunning && !paused) || !!terminal}
              >
                {freshEachRun ? `Run ${itersPerRun} iters (fresh)` : `Run ${itersPerRun} iters`}
              </button>

              {/* pause / resume + cancel */}
              <button
                onClick={onPauseResume}
                className={classNames(
                  "px-3 py-1.5 rounded-lg text-white font-medium shadow hover:shadow-md disabled:opacity-40",
                  "bg-amber-500 hover:bg-amber-600"
                )}
                disabled={!isRunning}
              >
                {paused ? "Resume" : "Pause"}
              </button>

              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-medium shadow hover:shadow-md hover:bg-rose-600 disabled:opacity-40"
                disabled={!isRunning}
              >
                Cancel
              </button>

              <div className="flex items-center gap-2 ml-3">
                <label className="text-sm text-slate-600">Animate every</label>
                <select
                  className="px-2 py-1 rounded-lg border border-slate-300 bg-white"
                  value={animateEvery}
                  onChange={(e) => setAnimateEvery(e.target.value)}
                >
                  <option value="1">1 iter (all)</option>
                  <option value="5">5 iters</option>
                  <option value="10">10 iters</option>
                  <option value="last">Last only</option>
                </select>
              </div>

              {isRunning && (
                <span
                  className={classNames(
                    "ml-auto text-xs px-2 py-0.5 rounded-md border",
                    paused ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}
                >
                  {paused ? "Paused" : "Running"}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">{preset.note}</p>

            {/* phase bar */}
            <div className="flex items-center gap-2 text-xs">
              {[
                { key: "selection", label: "Selection", color: "bg-sky-500" },
                { key: "expansion", label: "Expansion", color: "bg-amber-500" },
                { key: "simulation", label: "Simulation", color: "bg-slate-600" },
                { key: "backprop", label: "Backpropagation", color: "bg-emerald-600" },
              ].map(({ key, label, color }, i) => (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className={classNames(
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-white",
                      phase === key ? color : "bg-slate-300"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={classNames(phase === key ? "font-semibold" : "text-slate-500")}>{label}</span>
                  {i < 3 && <span className="text-slate-300">—</span>}
                </div>
              ))}
            </div>

            {/* board with axes + overlays */}
            <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-3 w-max">
              <div></div>
              {[1, 2, 3].map((c) => (
                <div key={`c${c}`} className="text-center font-medium text-slate-500">{c}</div>
              ))}
              {[1, 2, 3].map((r) => (
                <React.Fragment key={`r${r}`}>
                  <div className="flex items-center justify-center font-medium text-slate-500">{r}</div>
                  {[0, 1, 2].map((c) => {
                    const idx = (r - 1) * 3 + c;
                    const child = root.children.get(idx);
                    const N = child?.N ?? 0;
                    const heat = maxN > 0 ? N / maxN : 0;
                    const isBest = bestChildMove === idx;
                    const sel = selRootMove === idx;
                    const exp = expRootMove === idx;
                    const ghost = simOverlay[idx];
                    return (
                      <CellView
                        key={idx}
                        value={board[idx]}
                        onClick={() => placeMark(idx)}
                        isBest={isBest}
                        sel={sel}
                        exp={exp}
                        heat={heat}
                        count={N}
                        ghost={ghost as "X" | "O" | null}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* bottom controls: C and iters */}
            <div className="mt-2 grid gap-4">
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-500">Exploration constant C (higher = more exploration)</label>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <input type="range" min={0} max={10} step={0.05} value={C} onChange={(e) => setC(parseFloat(e.target.value))} className="w-full" />
                  <input
                    type="number"
                    value={C}
                    step={0.05}
                    min={0}
                    max={10}
                    onChange={(e) => setC(Math.max(0, Math.min(2, parseFloat(e.target.value || "0"))))}
                    className="w-24 px-2 py-1 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs uppercase tracking-wide text-slate-500">Iterations per run</label>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={3000}
                    step={10}
                    value={itersPerRun}
                    onChange={(e) => setItersPerRun(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="number"
                    value={itersPerRun}
                    min={10}
                    max={5000}
                    step={10}
                    onChange={(e) => setItersPerRun(Math.max(10, Math.min(5000, parseInt(e.target.value || "0"))))}
                    className="w-24 px-2 py-1 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {terminal && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                This position is terminal: {terminal === "D" ? "Draw" : `${terminal} wins`}.
              </div>
            )}
          </div>

          {/* right: stats */}
          <aside className="p-4 rounded-2xl bg-white shadow-sm md:sticky md:top-6 flex flex-col" style={leftHeight ? { height: leftHeight } : undefined}>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Results</h3>
              {bestChildMove !== null && (
                <span className="text-xs px-2 py-1 rounded-lg bg-violet-100 text-violet-800 border border-violet-200">
                  Recommended: {indexToCoord(bestChildMove)}
                </span>
              )}
              {/* total iterations badge */}
              <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                Total iters: {totalIters}
              </span>
            </div>

            {root.children.size === 0 && <p className="mt-2 text-sm text-slate-600">Run iterations to build the search.</p>}

            <div className="mt-3 grid gap-3 flex-1 overflow-auto">
              {[...root.children.entries()]
                .sort((a, b) => b[1].N - a[1].N)
                .map(([m, ch]) => {
                  const Q = ch.N ? ch.W / ch.N : 0;
                  const maxNLocal = Math.max(1, ...[...root.children.values()].map((c) => c.N));
                  const pct = Math.round((ch.N / maxNLocal) * 100);
                  return (
                    <div key={m} className={classNames("p-3 rounded-xl border", bestChildMove === m ? "border-violet-300 bg-violet-50" : "border-slate-200")}>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium">Move {indexToCoord(m)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">Visits: {ch.N}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">Q: {Q.toFixed(3)}</span>
                        <span className="ml-auto text-xs text-slate-600">W/D/L: {ch.wins}/{ch.draws}/{ch.losses}</span>
                      </div>
                      <div className="mt-2 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
