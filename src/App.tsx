import React, { useMemo, useState, useRef, useLayoutEffect } from "react";

type Cell = 'X' | 'O' | null;
type Board = Cell[];    // length 9
type Outcome = 'X' | 'O' | 'D';    // D = draw/tie

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
  if (board.every(Boolean)) return 'D';
  return null;
}

function legalMoves(board: Board): number[] {
  const moves: number[] = [];
  board.forEach((c, i) => { if (!c) moves.push(i); });
  return moves;
}

function nextPlayer(board: Board): 'X' | 'O' {
  const x = board.filter(c => c === 'X').length;
  const o = board.filter(c => c === 'O').length;
  return x === o ? 'X' : 'O';
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rollout(board: Board, playerToMove: 'X' | 'O'): Outcome {
  const b = board.slice();
  let p = playerToMove;
  let winner = checkWinner(b);
  while (!winner) {
    const moves = legalMoves(b);
    if (moves.length === 0) return 'D';
    const m = randomChoice(moves);
    b[m] = p;
    p = p === 'X' ? 'O' : 'X';
    winner = checkWinner(b);
  }
  return winner;
}

function simulateMove(base: Board, move: number, player: 'X' | 'O', sims: number) {
  // apply move once, then random playout many times
  let wins = 0, draws = 0, losses = 0;
  for (let k = 0; k < sims; k++) {
    const b = base.slice();
    b[move] = player;    // candidate move
    const outcome = rollout(b, player === 'X' ? 'O' : 'X');
    if (outcome === player) wins++;
    else if (outcome === 'D') draws++;
    else losses++;
  }
  return { wins, draws, losses };
}



// presets for the user to see and play around with
const PRESETS: { key: string; name: string; board: Board; note: string }[] = [
  {
    key: 'empty',
    name: 'Empty board',
    board: [null, null, null, null, null, null, null, null, null],
    note: 'Classic start. Good for feeling variance vs. sample size.',
  },
  {
    key: 'midgame1',
    name: 'Midgame (X to move)',
    board: [
      'X', 'O', null,
      null, 'X', null,
      'O', null, null,
    ],
    note: 'A typical midgame fork opportunity for X.',
  },
  {
    key: 'endgame1',
    name: 'Near endgame (X to move)',
    board: [
      'X', 'O', 'X',
      'O', 'X', null,
      null, 'O', null,
    ],
    note: 'Small action set; faster convergence of estimates.',
  },
  {
  key: 'mustblock_pure',
  name: 'Must block (X to move)',
  board: [
    'O','O', null,
    null,'X', null,
    null,'X', null,
  ],
  note: 'Pure random rollouts. X should block at (1,3); low sims may wobble.',
  },
];



// ui helpers
function pct(n: number, d: number): number { return d === 0 ? 0 : Math.round((100 * n) / d); }

function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function indexToCoord(i: number): string {
  const row = Math.floor(i / 3) + 1;
  const col = (i % 3) + 1;
  return `(${row},${col})`;
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const p = total ? (value / total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm"><span>{label}</span><span>{pct(value, total)}%</span></div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full w-0 transition-all duration-500" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function CellView({ value, onClick, highlight }:{ value: Cell; onClick?: ()=>void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        'aspect-square w-20 sm:w-24 md:w-28 grid place-items-center text-2xl font-semibold rounded-2xl',
        'border border-gray-300 hover:shadow-md transition',
        highlight ? 'ring-4 ring-emerald-400' : ''
      )}
    >
      {value ?? ''}
    </button>
  );
}



// main component
export default function MonteCarloTicTacToePart1() {
  const [presetKey, setPresetKey] = useState(PRESETS[1].key);
  const [board, setBoard] = useState<Board>(PRESETS[1].board);
  const [simsPerMove, setSimsPerMove] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Record<number, { wins: number; draws: number; losses: number }> | null>(null);

  const currentPlayer = useMemo(() => nextPlayer(board), [board]);
  const moves = useMemo(() => legalMoves(board), [board]);
  const terminal = useMemo(() => checkWinner(board), [board]);

  // match right panel height to left panel
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [leftHeight, setLeftHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      if (leftPanelRef.current) setLeftHeight(leftPanelRef.current.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // deps that can change left panel height:
  }, [board, results, simsPerMove, presetKey, terminal]);

  // run MCTS for all legal moves
  const run = async () => {
    setIsRunning(true);
    await new Promise(r => setTimeout(r, 30));
    const agg: Record<number, { wins: number; draws: number; losses: number }> = {};
    for (const m of moves) {
      agg[m] = simulateMove(board, m, currentPlayer, simsPerMove);
    }
    setResults(agg);
    setIsRunning(false);
  };

  const bestMove = useMemo(() => {
    if (!results) return null;
    let best: number | null = null;
    let bestScore = -Infinity;
    for (const m of Object.keys(results).map(Number)) {
      const { wins, draws, losses } = results[m];
      const total = wins + draws + losses;
      const score = total ? (wins + 0.5 * draws) / total : 0;    // win = 1, draw = 0.5, loss = 0
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }, [results]);

  const handlePreset = (key: string) => {
    const p = PRESETS.find(x => x.key === key)!;
    setPresetKey(key);
    setBoard(p.board.slice());
    setResults(null);
  };

  const placeMark = (i: number) => {
    if (terminal || board[i]) return;
    const b = board.slice();
    b[i] = currentPlayer;
    setBoard(b);
    setResults(null);
  };

  const resetBoard = () => {
    const p = PRESETS.find(x => x.key === presetKey)!;
    setBoard(p.board.slice());
    setResults(null);
  };

  const totalFor = (m: number) => {
    const r = results?.[m];
    return r ? r.wins + r.draws + r.losses : 0;
  };

  const preset = PRESETS.find(p => p.key === presetKey)!;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-100 text-slate-800 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto grid gap-6 md:gap-8">

        {/* header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Monte Carlo Tree Search</h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600">
              Monte Carlo Search estimates how good each possible move is by simulating the game many times from the current position to the end using random moves. For each legal move, we track how often it leads to a win, draw, or loss from the current player’s perspective, and compute a score (Win = 1, Draw = 0.5, Loss = 0). Because the simulations are random, low simulation counts can make bad moves look good by chance. As you increase the number of simulations, the estimates should stabilize, and the recommended move becomes more consistent (at the cost of more computation).
            </p>
          </div>
        </header>

        {/* tutorial explanation */}
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-900 p-4 sm:p-5">
          <h2 className="text-base sm:text-lg font-semibold">Demo guide: what to look for</h2>
          <ul className="mt-2 list-disc ml-5 text-sm sm:text-base space-y-1">
            <li><span className="font-medium">Pick a preset</span> position from the dropdown.</li>
            <li><span className="font-medium">Start with a low number of simulations</span> (e.g., 1–5) and click <em>Run Monte Carlo</em>. Then, on the right panel, you can scroll through the calculated average scores for each move. Results may vary between runs due to randomness.</li>
            <li><span className="font-medium">Increase simulations</span> (tens → hundreds) and rerun. Win/Draw/Loss bars should become more stable, and the recommended move should change less often.</li>
            <li><span className="font-medium">Try editing the board</span>: click an empty cell to play a move for the current player, then run again to see how evaluations shift.</li>
            <li><span className="font-medium">Takeaway</span>: more simulations → less variance → more reliable estimates, but higher computation cost.</li>
          </ul>
        </section>

        {/* controls */}
        <section className="grid md:grid-cols-3 gap-6 items-start">
          {/* left: board + controls */}
          <div
            ref={leftPanelRef}
            className="md:col-span-2 grid gap-4 p-4 rounded-2xl bg-white shadow-sm"
          >
            {/* top row: preset + inline buttons on the right */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium">Preset:</label>
              <select
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                value={presetKey}
                onChange={(e) => handlePreset(e.target.value)}
              >
                {PRESETS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
              <div className="grow" />
              <button
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium shadow hover:shadow-md hover:bg-emerald-600 disabled:opacity-50"
                onClick={run}
                disabled={isRunning || terminal !== null || moves.length === 0}
              >
                {isRunning ? 'Running…' : 'Run Monte Carlo'}
              </button>
              <button
                className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-sm font-medium shadow hover:shadow-md hover:bg-rose-600"
                onClick={resetBoard}
              >
                Reset
              </button>
            </div>

            <p className="text-xs text-slate-500">{preset.note}</p>

            {/* Coordinate-labeled board */}
            <div>
              <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-3 w-max">
                <div></div>
                {[1,2,3].map(c => (
                  <div key={`col${c}`} className="text-center font-medium text-slate-500">{c}</div>
                ))}
                {[1,2,3].map(r => (
                  <React.Fragment key={`row${r}`}>
                    <div className="flex items-center justify-center font-medium text-slate-500">{r}</div>
                    {[0,1,2].map(c => {
                      const idx = (r-1)*3 + c;
                      return <CellView key={idx} value={board[idx]} onClick={() => placeMark(idx)} highlight={bestMove === idx && !!results} />;
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* bottom row: Player to move on left, Sims per move on right (slider fills remaining space) */}
            <div className="mt-2 flex flex-wrap items-start gap-6">
              <div className="grid gap-1 shrink-0">
                <span className="text-xs uppercase tracking-wide text-slate-500">Player to move</span>
                <span className={classNames('text-lg font-semibold', currentPlayer === 'X' ? 'text-indigo-600' : 'text-pink-600')}>
                  {currentPlayer}
                </span>
              </div>

              <div className="grid gap-1 flex-1 min-w-[260px]">
                <label htmlFor="sims" className="text-xs uppercase tracking-wide text-slate-500">
                  Simulations per move
                </label>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <input
                    id="sims"
                    type="range"
                    min={1}
                    max={500}
                    step={1}
                    value={simsPerMove}
                    onChange={(e)=> setSimsPerMove(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="number"
                    className="w-20 px-2 py-1 border border-slate-300 rounded-lg"
                    value={simsPerMove}
                    onChange={(e)=> setSimsPerMove(Math.max(1, parseInt(e.target.value||'0')))}
                  />
                </div>
              </div>
            </div>



            {terminal && (
              <div className="mt-2 p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm">
                This position is terminal: {terminal === 'D' ? 'Draw' : `${terminal} wins`}. Try a different preset or add a move.
              </div>
            )}
          </div>

          {/* right: results (sticky, scrollable, height matches left panel) */}
          <aside
            className="p-4 rounded-2xl bg-white shadow-sm md:sticky md:top-6 flex flex-col"
            style={leftHeight ? { height: leftHeight } : undefined}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Results</h3>
              {results && bestMove !== null && (
                <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Recommended: {indexToCoord(bestMove)}
                </span>
              )}
            </div>

            {!results && (
              <p className="mt-2 text-sm text-slate-600">
                Run the simulation to see per-move estimates. Click a cell to add your own moves to the preset, then evaluate again.
              </p>
            )}

            {/* scroll only the list; panel itself stays same height as left */}
            <div className="mt-3 grid gap-4 flex-1 overflow-auto">
              {results && moves.map((m) => {
                const r = results[m];
                const total = totalFor(m);
                const score = total ? ((r.wins + 0.5*r.draws) / total) : 0;
                return (
                  <div key={m} className={classNames(
                    'p-3 rounded-xl border',
                    bestMove === m ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'
                  )}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium">Move at {indexToCoord(m)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">Total playouts: {total}</span>
                      <span className="ml-auto text-sm">Score: <span className="font-semibold">{score.toFixed(3)}</span></span>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <Bar label="Wins" value={r.wins} total={total} />
                      <Bar label="Draws" value={r.draws} total={total} />
                      <Bar label="Losses" value={r.losses} total={total} />
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
