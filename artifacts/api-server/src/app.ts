import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import type { NextFunction, Request, Response } from "express";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled API error");

  if (res.headersSent) {
    return;
  }

  const message =
    err instanceof Error ? err.message : "Something went wrong on the server.";
  const statusCode =
    err instanceof Error && message.toLowerCase().includes("gemini")
      ? 503
      : 500;

  res.status(statusCode).json({
    error:
      statusCode === 503
        ? "Flashcard generation is temporarily unavailable. Please try again."
        : "Internal server error",
  });
});

export default app;
