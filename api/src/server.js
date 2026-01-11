import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes/index.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 4000, () =>
  console.log("API running")
);