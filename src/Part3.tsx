import { useMemo, useState } from "react";

// helpers
function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Child = { id: string; N: number; W: number };
type Scenario = {
  C: number;
  parentN: number;
  children: Child[];
};

function uct(parentN: number, child: Child, C: number) {
  const q = child.N > 0 ? child.W / child.N : 0;
  const u = C * Math.sqrt(Math.log(parentN + 1) / (child.N + 1));
  return q + u;
}



// activity B
function ExerciseDriveUCT() {
  const schedule: Record<string, number[]> = {
    A: [1, 0, 1, 0, 1],
    B: [0, 0, 1, 0, 0],
    C: [1, 1, 0, 1, 1],
  };
  const [C, setC] = useState(1);

  const [parentN, setParentN] = useState(0);
  const [kids, setKids] = useState<Record<string, Child>>({
    A: { id: "A", N: 0, W: 0 },
    B: { id: "B", N: 0, W: 0 },
    C: { id: "C", N: 0, W: 0 },
  });
  const [ptrs, setPtrs] = useState<Record<string, number>>({ A: 0, B: 0, C: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);

  // track wrong picks
  const [disabledWrong, setDisabledWrong] = useState<Set<"A" | "B" | "C">>(new Set());

  const values = useMemo(() => {
    const entries = ["A", "B", "C"].map((id) => {
      const ch = kids[id];
      return [id, uct(parentN, ch, C)] as const;
    });
    entries.sort((a, b) => b[1] - a[1]);
    return {
      uct: Object.fromEntries(entries.map(([id, v]) => [id, v])) as Record<string, number>,
      best: entries[0][0] as "A" | "B" | "C",
    };
  }, [kids, parentN, C]);

  const choose = (id: "A" | "B" | "C") => {
    const correct = values.best;
    const ok = id === correct;

    if (!ok) {
      setFeedback(`Not quite, try again.`);
      setDisabledWrong((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // don't advance count on wrong picks
      return;
    }

    setFeedback("Correct — that maximizes UCT.");

    // advance one iteration for the correct child
    const outcomeArr = schedule[id];
    const ix = ptrs[id] % outcomeArr.length;
    const reward = outcomeArr[ix];

    setPtrs((p) => ({ ...p, [id]: ix + 1 }));
    setKids((prev) => {
      const nxt = { ...prev };
      nxt[id] = { ...nxt[id], N: nxt[id].N + 1, W: nxt[id].W + reward };
      return nxt;
    });
    setParentN((n) => n + 1);

    setDisabledWrong(new Set());
  };

  const reset = () => {
    setParentN(0);
    setKids({ A: { id: "A", N: 0, W: 0 }, B: { id: "B", N: 0, W: 0 }, C: { id: "C", N: 0, W: 0 } });
    setPtrs({ A: 0, B: 0, C: 0 });
    setFeedback(null);
    setC(1);
    setDisabledWrong(new Set());
  };

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold">Activity A — UCT Selection</h3>
      <p className="mt-1 text-sm text-slate-600">
        Choose which child UCT would explore next.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Exploration constant C</span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.05}
          value={C}
          onChange={(e) => setC(parseFloat(e.target.value))}
          className="w-40"
        />
        <input
          type="number"
          min={0}
          max={10}
          step={0.05}
          value={C}
          onChange={(e) => setC(parseFloat(e.target.value || "0"))}
          className="w-20 px-2 py-1 border border-slate-300 rounded-md"
        />

        <span className="ml-auto text-xs px-2 py-0.5 rounded-md border bg-slate-50">
          Total iterations so far: <span className="font-semibold">{parentN}</span>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1">Child</th>
              <th className="py-1">N</th>
              <th className="py-1">W</th>
              <th className="py-1">Q = W/N</th>
              <th className="py-1">UCT</th>
              <th className="py-1">Pick next?</th>
            </tr>
          </thead>
          <tbody>
            {(["A", "B", "C"] as const).map((id) => {
              const ch = kids[id];
              const q = ch.N ? ch.W / ch.N : 0;
              const u = uct(parentN, ch, C);
              const disabled = disabledWrong.has(id);
              return (
                <tr key={id} className={classNames("border-b", disabled && "opacity-50")}>
                  <td className="py-1 font-medium">Child {id}</td>
                  <td className="py-1">{ch.N}</td>
                  <td className="py-1">{ch.W}</td>
                  <td className="py-1">{ch.N ? q.toFixed(3) : "—"}</td>
                  <td className="py-1">{u.toFixed(3)}</td>
                  <td className="py-1">
                    <button
                      onClick={() => !disabled && choose(id)}
                      disabled={disabled}
                      className={classNames(
                        "px-2 py-1 rounded-md border",
                        disabled ? "border-slate-200 bg-slate-100 cursor-not-allowed" : "border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      Choose
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {feedback && (
        <div
          className={classNames(
            "mt-3 text-sm px-3 py-2 rounded-lg border",
            feedback.startsWith("Correct") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
          )}
        >
          {feedback}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button onClick={reset} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600">
          Reset exercise
        </button>
        <div className="text-xs text-slate-500">
          Tip: try a few steps at different <span className="font-medium">C</span> values and notice how the “best” child shifts.
        </div>
      </div>
    </div>
  );
}



// activity B
function ExerciseUCTCalculator() {
  // generate a scenario with 3 children
  const makeScenario = (): Scenario => {
    const Ns = [0, 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    for (let i = Ns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [Ns[i], Ns[j]] = [Ns[j], Ns[i]];
    }
    const children: Child[] = ["A", "B", "C"].map((id, i) => {
      const N = Ns[i];
      const W = N === 0 ? 0 : Math.floor(Math.random() * (N + 1)); // 0..N
      return { id, N, W };
    });
    const parentN = children.reduce((s, c) => s + c.N, 0);
    return { C: 1, parentN, children };
  };

  const [sc, setSc] = useState<Scenario>(makeScenario());
  const [C, setC] = useState<number>(1);
  const [inputs, setInputs] = useState<Record<string, string>>({ A: "", B: "", C: "" });
  const [guess, setGuess] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [showAns, setShowAns] = useState(false);

  const exact = useMemo(() => {
    const vals = Object.fromEntries(sc.children.map((ch) => [ch.id, uct(sc.parentN, ch, C)])) as Record<string, number>;
    const best = sc.children.slice().sort((a, b) => vals[b.id] - vals[a.id])[0].id;
    return { vals, best };
  }, [sc, C]);

  const tol = 0.01;
  const graded = useMemo(() => {
    if (!checked) return null;
    const numOk: Record<string, boolean> = { A: false, B: false, C: false };
    (["A", "B", "C"] as const).forEach((id) => {
      const v = parseFloat(inputs[id]);
      numOk[id] = Number.isFinite(v) && Math.abs(v - exact.vals[id]) <= tol;
    });
    const guessOk = guess === exact.best;
    return { numOk, guessOk };
  }, [checked, inputs, guess, exact]);

  const reset = () => {
    setSc(makeScenario());
    setInputs({ A: "", B: "", C: "" });
    setGuess(null);
    setChecked(false);
    setShowAns(false);
    setC(1);
  };

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold">Activity B — UCT Calculator</h3>
      <p className="mt-1 text-sm text-slate-600">
        Compute <code>UCT = Q + C·√(ln N<span className="align-top text-[10px]">parent</span> / (N
        <span className="align-top text-[10px]">child</span>+1))</code> for each child and pick the best.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Exploration constant C</span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.05}
              value={C}
              onChange={(e) => setC(parseFloat(e.target.value))}
              className="w-40"
            />
            <input
              type="number"
              min={0}
              max={10}
              step={0.05}
              value={C}
              onChange={(e) => setC(parseFloat(e.target.value || "0"))}
              className="w-20 px-2 py-1 border border-slate-300 rounded-md"
            />
          </div>

          <div className="mt-2 text-sm">
            <div>
              <span className="font-medium">Parent visits N:</span> {sc.parentN}
            </div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Child</th>
                  <th className="py-1">
                    N<span className="align-top text-[10px]">child</span>
                  </th>
                  <th className="py-1">W</th>
                  <th className="py-1">Q = W/N</th>
                </tr>
              </thead>
              <tbody>
                {sc.children.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-1">{c.id}</td>
                    <td className="py-1">{c.N}</td>
                    <td className="py-1">{c.W}</td>
                    <td className="py-1">{c.N ? (c.W / c.N).toFixed(3) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-sm text-slate-700">Enter your UCT values:</div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {(["A", "B", "C"] as const).map((id) => {
              const ok = graded?.numOk[id];
              const valShown = showAns ? exact.vals[id].toFixed(3) : inputs[id];
              return (
                <div key={id}>
                  <label className="block text-xs text-slate-500 mb-1">Child {id}</label>
                  <input
                    type="text"
                    value={valShown}
                    onChange={(e) => setInputs((s) => ({ ...s, [id]: e.target.value }))}
                    disabled={showAns}
                    className={classNames(
                      "w-full px-2 py-1 rounded-md border",
                      showAns ? "bg-slate-50 text-slate-600" : "bg-white",
                      graded ? (ok ? "border-emerald-300" : "border-rose-300") : "border-slate-300"
                    )}
                    placeholder="e.g., 1.234"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-sm">
            <div className="font-medium mb-1">Which child would UCT pick?</div>
            <div className="flex items-center gap-4">
              {(["A", "B", "C"] as const).map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <input type="radio" name="best" value={id} checked={guess === id} onChange={() => setGuess(id)} />
                  <span>Child {id}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setChecked(true)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:opacity-90">
              Check answers
            </button>
            <button onClick={() => setShowAns((v) => !v)} className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
              {showAns ? "Hide answer" : "Show answer"}
            </button>
            <button onClick={reset} className="ml-auto px-3 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600">
              New scenario
            </button>
          </div>

          {checked && (
            <div className="mt-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Your result:</span>
                <span
                  className={classNames(
                    "px-2 py-0.5 rounded-md border text-xs",
                    graded?.guessOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                  )}
                >
                  {graded?.guessOk ? "Correct" : `UCT would pick Child ${exact.best}`}
                </span>
              </div>
              <div className="mt-2 text-slate-600">
                Exact UCT: A={exact.vals.A.toFixed(3)}, B={exact.vals.B.toFixed(3)}, C={exact.vals.C.toFixed(3)}
                <span className="ml-2 text-xs">(accepted ±0.01)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



// activity C
type OutcomeLetter = "W" | "D" | "L";
type LogEntry = { child: "A" | "B" | "C"; outcome: OutcomeLetter };

function outcomeReward(o: OutcomeLetter) {
  if (o === "W") return 1;
  if (o === "D") return 0.5;
  return 0;
}

function makeLog(): LogEntry[] {
  // a short fixed-ish log with mild randomness
  const choices: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  const len = 6 + Math.floor(Math.random() * 3); // 6–8 entries
  const log: LogEntry[] = [];
  for (let i = 0; i < len; i++) {
    const c = choices[Math.floor(Math.random() * choices.length)];

    // skew outcomes slightly so it's not pure uniform
    const r = Math.random();
    const o: OutcomeLetter = r < 0.45 ? "W" : r < 0.7 ? "D" : "L";
    log.push({ child: c, outcome: o });
  }
  return log;
}

function crunch(log: LogEntry[]) {
  const per: Record<"A" | "B" | "C", { N: number; W: number; Q: number }> = {
    A: { N: 0, W: 0, Q: 0 },
    B: { N: 0, W: 0, Q: 0 },
    C: { N: 0, W: 0, Q: 0 },
  };
  let rootN = 0;
  let rootW = 0;
  for (const e of log) {
    per[e.child].N += 1;
    const r = outcomeReward(e.outcome);
    per[e.child].W += r;
    rootN += 1;
    rootW += r;
  }
  (["A", "B", "C"] as const).forEach((k) => {
    per[k].Q = per[k].N ? per[k].W / per[k].N : 0;
  });
  const best = (["A", "B", "C"] as const).reduce((bestSoFar, k) => {
    if (per[k].Q > per[bestSoFar].Q) return k;
    if (Math.abs(per[k].Q - per[bestSoFar].Q) < 1e-9) {

      // tie-breaker: higher N, then alphabetical
      if (per[k].N > per[bestSoFar].N) return k;
      if (per[k].N === per[bestSoFar].N && k < bestSoFar) return k;
    }
    return bestSoFar;
  }, "A" as "A" | "B" | "C");
  return { per, rootN, rootW, best };
}

function ExerciseBackpropBookkeeping() {
  const [log, setLog] = useState<LogEntry[]>(makeLog());
  const truth = useMemo(() => crunch(log), [log]);

  const [inputs, setInputs] = useState<{
    A_N: string; A_W: string;
    B_N: string; B_W: string;
    C_N: string; C_W: string;
    ROOT_N: string; ROOT_W: string;
    BEST: "A" | "B" | "C" | "";
  }>({
    A_N: "", A_W: "",
    B_N: "", B_W: "",
    C_N: "", C_W: "",
    ROOT_N: "", ROOT_W: "",
    BEST: "",
  });

  const [checked, setChecked] = useState(false);
  const [showAns, setShowAns] = useState(false);
  const tol = 0.01; // tolerance for W

  const isInt = (s: string) => /^\s*-?\d+\s*$/.test(s);
  const asNum = (s: string) => parseFloat(s);

  const graded = useMemo(() => {
    if (!checked) return null;
    const ok: Record<string, boolean> = {};
    ok.A_N = isInt(inputs.A_N) && parseInt(inputs.A_N) === truth.per.A.N;
    ok.B_N = isInt(inputs.B_N) && parseInt(inputs.B_N) === truth.per.B.N;
    ok.C_N = isInt(inputs.C_N) && parseInt(inputs.C_N) === truth.per.C.N;
    ok.ROOT_N = isInt(inputs.ROOT_N) && parseInt(inputs.ROOT_N) === truth.rootN;

    ok.A_W = Number.isFinite(asNum(inputs.A_W)) && Math.abs(asNum(inputs.A_W) - truth.per.A.W) <= tol;
    ok.B_W = Number.isFinite(asNum(inputs.B_W)) && Math.abs(asNum(inputs.B_W) - truth.per.B.W) <= tol;
    ok.C_W = Number.isFinite(asNum(inputs.C_W)) && Math.abs(asNum(inputs.C_W) - truth.per.C.W) <= tol;
    ok.ROOT_W = Number.isFinite(asNum(inputs.ROOT_W)) && Math.abs(asNum(inputs.ROOT_W) - truth.rootW) <= tol;

    ok.BEST = inputs.BEST === truth.best;

    const allOk = Object.values(ok).every(Boolean);
    return { ok, allOk };
  }, [checked, inputs, truth]);

  const reset = () => {
    setLog(makeLog());
    setInputs({
      A_N: "", A_W: "",
      B_N: "", B_W: "",
      C_N: "", C_W: "",
      ROOT_N: "", ROOT_W: "",
      BEST: "",
    });
    setChecked(false);
    setShowAns(false);
  };

  const showVal = (k: keyof typeof inputs, v: string | number) => (showAns ? String(v) : inputs[k]);

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <h3 className="text-lg font-semibold">Activity C — Understanding Backpropagation</h3>
      <p className="mt-1 text-sm text-slate-600">
        Below is a log of rollouts from the root. Treat <code>W=1</code>, <code>D=0.5</code>, <code>L=0</code>. Fill in each child’s
        <strong> N</strong> (visits) and <strong> W</strong> (total reward), the root’s totals, and pick which child has the highest average payoff
        <code> Q=W/N</code>. Then check your answers.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* left: rollout log */}
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-sm font-medium mb-1">Rollout log</div>
          <ol className="list-decimal ml-5 text-sm text-slate-700 space-y-1">
            {log.map((e, i) => (
              <li key={i}>
                Child <span className="font-semibold">{e.child}</span> →{" "}
                <span className="font-semibold">
                  {e.outcome === "W" ? "Win (1)" : e.outcome === "D" ? "Draw (0.5)" : "Loss (0)"}
                </span>
              </li>
            ))}
          </ol>
          <button
            onClick={() => setLog(makeLog())}
            className="mt-3 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
          >
            New log
          </button>
        </div>

        {/* right: inputs & grading */}
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-sm text-slate-700">Totals per child</div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Child</th>
                <th className="py-1">N</th>
                <th className="py-1">W</th>
                <th className="py-1">Q=W/N</th>
              </tr>
            </thead>
            <tbody>
              {(["A", "B", "C"] as const).map((id) => {
                const t = truth.per[id];
                const okN = graded?.ok[`${id}_N`];
                const okW = graded?.ok[`${id}_W`];
                return (
                  <tr key={id} className="border-t">
                    <td className="py-1 font-medium">{id}</td>
                    <td className="py-1">
                      <input
                        value={showVal(`${id}_N` as any, t.N)}
                        onChange={(e) => setInputs((s) => ({ ...s, [`${id}_N`]: e.target.value } as any))}
                        disabled={showAns}
                        className={classNames(
                          "w-20 px-2 py-1 rounded-md border",
                          graded ? (okN ? "border-emerald-300" : "border-rose-300") : "border-slate-300",
                          showAns ? "bg-slate-50" : "bg-white"
                        )}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={showVal(`${id}_W` as any, t.W.toFixed(1))}
                        onChange={(e) => setInputs((s) => ({ ...s, [`${id}_W`]: e.target.value } as any))}
                        disabled={showAns}
                        className={classNames(
                          "w-24 px-2 py-1 rounded-md border",
                          graded ? (okW ? "border-emerald-300" : "border-rose-300") : "border-slate-300",
                          showAns ? "bg-slate-50" : "bg-white"
                        )}
                      />
                    </td>
                    <td className="py-1">{t.N ? t.Q.toFixed(3) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <div>
              <div className="text-sm text-slate-700">Root totals</div>
              <div className="mt-1 flex items-center gap-2">
                <label className="text-xs text-slate-500">N</label>
                <input
                  value={showVal("ROOT_N", truth.rootN)}
                  onChange={(e) => setInputs((s) => ({ ...s, ROOT_N: e.target.value }))}
                  disabled={showAns}
                  className={classNames(
                    "w-24 px-2 py-1 rounded-md border",
                    graded ? (graded.ok.ROOT_N ? "border-emerald-300" : "border-rose-300") : "border-slate-300",
                    showAns ? "bg-slate-50" : "bg-white"
                  )}
                />
                <label className="text-xs text-slate-500 ml-3">W</label>
                <input
                  value={showVal("ROOT_W", truth.rootW.toFixed(1))}
                  onChange={(e) => setInputs((s) => ({ ...s, ROOT_W: e.target.value }))}
                  disabled={showAns}
                  className={classNames(
                    "w-28 px-2 py-1 rounded-md border",
                    graded ? (graded.ok.ROOT_W ? "border-emerald-300" : "border-rose-300") : "border-slate-300",
                    showAns ? "bg-slate-50" : "bg-white"
                  )}
                />
              </div>
            </div>

            <div>
                <div className="text-sm text-slate-700">Which child is best by average payoff?</div>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                    {(["A", "B", "C"] as const).map((id) => (
                    <label
                        key={id}
                        className={classNames(
                        "flex items-center gap-2 px-2 py-1 rounded-md",
                        // If checked & wrong, softly highlight the user's chosen (wrong) option
                        checked && !showAns && !(graded?.ok.BEST) && inputs.BEST === id
                            ? "bg-amber-50 border border-amber-200"
                            : ""
                        )}
                    >
                        <input
                        type="radio"
                        name="bestChild"
                        value={id}
                        checked={showAns ? truth.best === id : inputs.BEST === id}
                        onChange={() => setInputs((s) => ({ ...s, BEST: id }))}
                        disabled={showAns}
                        />
                        <span>Child {id}</span>
                    </label>
                    ))}
                </div>

                {/* show answers only in Show Answer mode */}
                {showAns && (
                    <div className="mt-2 text-xs px-2 py-1 rounded-md border bg-slate-50 w-max">
                    Answer: <span className="font-semibold">Child {truth.best}</span>
                    </div>
                )}

                {/* correctness badge when checking answers */}
                {checked && !showAns && (
                    <div
                    className={classNames(
                        "mt-2 text-xs px-2 py-1 rounded-md border w-max",
                        graded?.ok.BEST
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    )}
                    >
                    {graded?.ok.BEST ? "Correct" : "Not correct"}
                    </div>
                )}
                </div>

          </div>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setChecked(true)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:opacity-90">
              Check answers
            </button>
            <button onClick={() => setShowAns((v) => !v)} className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50">
              {showAns ? "Hide answer" : "Show answer"}
            </button>
            <button onClick={reset} className="ml-auto px-3 py-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600">
              New random log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// page wrapper
export default function Part3Exercises() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 grid gap-6">
        <header>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">MCTS/UCT Practice & Questions</h2>
            <ul className="mt-2 text-sm sm:text-base text-slate-700 list-disc ml-5 space-y-1">
                <li>
                <span className="font-semibold">Activity A:</span> UCT Selection — Practice choosing the next child for UCT.
                </li>
                <li>
                <span className="font-semibold">Activity B:</span> UCT Calculator — Compute UCT values for three children and
                choose the best child.
                </li>
                <li>
                <span className="font-semibold">Activity C:</span> Understanding Backpropagation — practice calculating the visits and reward for each child, and choosing the best one by average payoff.
                </li>
            </ul>
        </header>


        <ExerciseDriveUCT />
        <ExerciseUCTCalculator />
        <ExerciseBackpropBookkeeping />
      </div>
    </div>
  );
}
