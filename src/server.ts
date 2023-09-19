import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Client } from "pg";
import { getDbItemById } from "./db";
import filePath from "./filePath";

const app = express();

app.use(express.json());
app.use(cors());

import { Server } from "socket.io";
import * as http from "http";

const overallServer = http.createServer(app);

const io = new Server(overallServer, {
    cors: {
        origin: "*",
    },
    transports: ["websocket", "polling"],
});

console.log;

dotenv.config();

const PORT_NUMBER = process.env.PORT ?? 5000;
const dbUrl = process.env.DATABASE_URL;

const client = new Client(dbUrl);
client.connect();

// API info page
app.get("/", (req, res) => {
    const pathToFile = filePath("../public/index.html");
    res.sendFile(pathToFile);
});

app.get("/users", async (req, res) => {
    const queryText = "SELECT username FROM users";

    const users = await client.query(queryText);

    res.status(200).json(users.rows);
});

app.get("/hello", async (req, res) => {
    await res.status(200).json({ hello: "hello" });
});

app.get("/leaderboard", async (req, res) => {
    const queryText =
        "SELECT * FROM leaderboard JOIN users ON leaderboard.user_id = users.id ORDER BY score_section_1 DESC, score_section_2 DESC LIMIT 10;";
    const leaderboard = await client.query(queryText);

    res.status(200).json(leaderboard.rows);
});

app.post("/leaderboard", async (req, res) => {
    const checkUserQuery = "SELECT id FROM users WHERE username = $1;";
    const userQuery =
        "INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING RETURNING id ;";
    const leaderQuery =
        "INSERT INTO leaderboard (user_id, score_section_1, score_section_2) values($1, $2, $3) RETURNING *";

    let userId;

    const { username, score_section_1, score_section_2 } = req.body;
    const userValues = [username];
    const userCheck = await client.query(checkUserQuery, userValues);

    if (userCheck.rowCount > 0) {
        userId = userCheck.rows[0].id;
    } else {
        const userResult = await client.query(userQuery, userValues);
        userId = userResult.rows[0].id;
    }

    console.log(userId);

    const leaderboardValues = [userId, score_section_1, score_section_2];
    const result = await client.query(leaderQuery, leaderboardValues);

    io.emit("new-score", result.rows[0]);
    console.log("test");
    res.status(201).json(result.rows);
});

app.get<{ id: string }>("/items/:id", (req, res) => {
    const matchingSignature = getDbItemById(parseInt(req.params.id));
    if (matchingSignature === "not found") {
        res.status(404).json(matchingSignature);
    } else {
        res.status(200).json(matchingSignature);
    }
});

app.listen(PORT_NUMBER, () => {
    console.log(`Server is listening on port ${PORT_NUMBER}!`);
});
