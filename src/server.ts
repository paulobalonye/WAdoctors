import { env } from "./config/env.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(`WAdoctors API listening on port ${env.PORT}`);
});
