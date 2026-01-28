import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { analyzeVacancy } from "@/lib/backfill/analyzeVacancy";
import { fetchCandidates } from "@/lib/backfill/fetchCandidates";
import { rankCandidates } from "@/lib/backfill/rankCandidates";
import { executeOutreach } from "@/lib/backfill/outreach";
import { escalateBackfillRun } from "@/lib/backfill/escalate";
import type { CandidateRow, RankedCandidate, ShiftVacancy } from "@/lib/backfill/types";

type GraphState = {
  shiftId: string;
  runId?: string;
  vacancy?: ShiftVacancy;
  candidates?: CandidateRow[];
  ranked?: RankedCandidate[];
  chosenCaregiverId?: string;
  safetyRedactionsApplied?: string[];
  lastAttemptId?: string;
};

const GraphStateAnnotation = Annotation.Root({
  shiftId: Annotation<string>(),
  runId: Annotation<string | undefined>(),
  vacancy: Annotation<ShiftVacancy | undefined>(),
  candidates: Annotation<CandidateRow[] | undefined>(),
  ranked: Annotation<RankedCandidate[] | undefined>(),
  chosenCaregiverId: Annotation<string | undefined>(),
  safetyRedactionsApplied: Annotation<string[] | undefined>(),
  lastAttemptId: Annotation<string | undefined>(),
});

export function buildBackfillGraph() {
  const g = new StateGraph(GraphStateAnnotation)
    .addNode("analyze_vacancy", async (state: GraphState) => {
      const vacancy = await analyzeVacancy(state.shiftId);
      return { vacancy };
    })
    .addNode("fetch_candidates", async (state: GraphState) => {
      const candidates = await fetchCandidates({ shiftId: state.shiftId, radiusMiles: 10 });
      return { candidates };
    })
    .addNode("rank_candidates", async (state: GraphState) => {
      if (!state.vacancy) throw new Error("rank_candidates: missing vacancy");
      const candidates = state.candidates ?? [];
      if (candidates.length === 0) return { ranked: [], chosenCaregiverId: undefined };
      const out = await rankCandidates({ vacancy: state.vacancy, candidates });
      return {
        ranked: out.ranked,
        chosenCaregiverId: out.chosenCaregiverId,
        safetyRedactionsApplied: out.safetyRedactionsApplied,
      };
    })
    .addNode("execute_outreach", async (state: GraphState) => {
      if (!state.runId) return {};
      if (!state.vacancy) throw new Error("execute_outreach: missing vacancy");
      if (!state.ranked || state.ranked.length === 0) return {};
      const candidates = state.candidates ?? [];
      const sent = await executeOutreach({
        runId: state.runId,
        vacancy: state.vacancy,
        candidates,
        ranked: state.ranked,
      });
      return { lastAttemptId: sent?.attemptId };
    })
    .addNode("escalate", async (state: GraphState) => {
      if (!state.runId) return {};
      await escalateBackfillRun({ runId: state.runId, reason: "No eligible candidates found." });
      return {};
    })
    .addEdge(START, "analyze_vacancy")
    .addEdge("analyze_vacancy", "fetch_candidates")
    .addEdge("fetch_candidates", "rank_candidates")
    .addConditionalEdges("rank_candidates", (state: GraphState) => {
      if (!state.chosenCaregiverId) return "escalate";
      return "execute_outreach";
    })
    .addEdge("execute_outreach", END)
    .addEdge("escalate", END);

  return g.compile();
}

export async function runBackfillGraph(input: { shiftId: string; runId?: string }) {
  const app = buildBackfillGraph();
  return app.invoke({ shiftId: input.shiftId, runId: input.runId });
}

