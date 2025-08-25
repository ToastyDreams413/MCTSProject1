import { useState } from "react";
import MonteCarloTicTacToePart1 from "./Part1";
import MonteCarloTicTacToePart2 from "./Part2";
import ConnectFourPart3 from "./Part3"; // NEW

export default function App() {
  const [tab, setTab] = useState<"part1" | "part2" | "part3">("part1"); // add "part3"

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-100">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex items-center gap-2 p-3">
          <h1 className="text-xl sm:text-2xl font-semibold mr-4">Monte Carlo Tree Search</h1>

          <button
            onClick={() => setTab("part1")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === "part1"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
            aria-pressed={tab === "part1"}
          >
            Part 1
          </button>

          <button
            onClick={() => setTab("part2")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === "part2"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
            aria-pressed={tab === "part2"}
          >
            Part 2
          </button>

          <button
            onClick={() => setTab("part3")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              tab === "part3"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
            aria-pressed={tab === "part3"}
          >
            Part 3
          </button>
        </div>
      </nav>

      {tab === "part1" && <MonteCarloTicTacToePart1 />}
      {tab === "part2" && <MonteCarloTicTacToePart2 />}
      {tab === "part3" && <ConnectFourPart3 />}
    </div>
  );
}
