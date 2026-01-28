import { EventSchemas, Inngest } from "inngest";

export const inngest = new Inngest({
  id: "vali-shift-backfill",
  schemas: new EventSchemas().fromRecord<{
    "shift/cancelled": {
      data: {
        shiftId: string;
        cancelledBy?: string;
      };
    };
    "backfill/response": {
      data: {
        attemptId: string;
        decision: "accepted" | "declined" | "no_answer";
      };
    };
  }>(),
});

