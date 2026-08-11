import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getStats from "./tools/get-stats";
import listTasks from "./tools/list-tasks";
import completeTask from "./tools/complete-task";
import listAlarms from "./tools/list-alarms";
import recentCompletions from "./tools/recent-completions";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "axen-mcp",
  title: "Discipline Won Today",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in DWT user: read discipline stats, tasks, alarms, and recent completions, and mark a task complete for today.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getStats, listTasks, recentCompletions, listAlarms, completeTask],
});
