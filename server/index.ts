import "dotenv/config";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { Server } from "socket.io";
import pino from "pino";
import { Store } from "./store.js";
import { createApp } from "./app.js";

const log = pino();
const store = new Store();
await store.init();
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
  throw new Error("JWT_SECRET is required");
const secret = process.env.JWT_SECRET || randomBytes(32).toString("hex");
const { app, tokens, listeners, closeQueue } = await createApp(store, secret);
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
    credentials: true,
  },
});
io.use(async (socket, next) => {
  try {
    socket.data.userId = await tokens.verify(socket.handshake.auth.token);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (socket) => {
  socket.join(socket.data.userId);
});
listeners.add((review) =>
  io
    .to(review.ownerId)
    .emit("review:update", { id: review.id, status: review.status }),
);
server.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    log.info("InsightCode API listening on port " + (process.env.PORT || 3001)),
);
async function shutdown() {
  await closeQueue();
  io.close();
  server.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
