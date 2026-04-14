import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import decksRouter from "./decks.js";
import cardsRouter from "./cards.js";
import generateRouter from "./generate.js";
import reviewsRouter from "./reviews.js";
import usersRouter from "./users.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/decks", decksRouter);
router.use(cardsRouter);
router.use("/generate", generateRouter);
router.use(reviewsRouter);
router.use("/users", usersRouter);

export default router;
