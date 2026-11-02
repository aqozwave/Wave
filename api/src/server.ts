import { createApp } from "./app.js";
import { startJobs } from "./jobs/startJobs.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
  // Jobs en el mismo proceso (node-cron / setInterval). Respetan *_ENABLED=false.
  startJobs();
});
