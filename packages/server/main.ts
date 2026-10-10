import { WebSocketServer } from "ws";
import { socketServerRouter } from "./src/services/socketServerRouter.js";
import { initHandlers } from "./src/services/socketService.js";
import { mediaTransferGuard } from "./src/services/mediaTransferGuard.js";

const wss = new WebSocketServer({ port: 8080 });

socketServerRouter.attach(wss);
initHandlers();
setInterval(() => {
  mediaTransferGuard.sweepStale();
}, 60_000);

console.log("Server started on port 8080.");
