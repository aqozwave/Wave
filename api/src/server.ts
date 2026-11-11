import { createApp } from "./app.js";
import { assertRequiredEnv } from "./lib/env.js";
import { startJobs } from "./jobs/startJobs.js";

assertRequiredEnv();

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

/**
 * Sin esto, un error en stream/async no manejado tumba el proceso para todos.
 * Logueamos y seguimos; el request afectado ya respondió o se cortó.
 */
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
  // Jobs en el mismo proceso (node-cron / setInterval). Respetan *_ENABLED=false.
  startJobs();
});
