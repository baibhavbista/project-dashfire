import { Server, matchMaker } from "colyseus";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { monitor } from "@colyseus/monitor";
import { TeamBattleRoom } from "./rooms/TeamBattleRoom";

const port = Number(process.env.PORT || 3000);
const app = express();

// Enable CORS for the client
app.use(cors());
app.use(express.json());

// Create HTTP server
const gameServer = new Server({
  server: createServer(app)
});

// Register room handlers
gameServer.define("team-battle", TeamBattleRoom);

// Register colyseus monitor for debugging
app.use("/colyseus", monitor());

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Colyseus Server is running!");
});

// Custom endpoint to get available rooms
app.get("/api/rooms/:roomName", async (req, res) => {
  try {
    const rooms = await matchMaker.query({ name: req.params.roomName });
    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Start the server
gameServer.listen(port);
console.log(`✨ Colyseus Server listening on ws://localhost:${port}`);
console.log(`📊 Monitor available at http://localhost:${port}/colyseus`); 