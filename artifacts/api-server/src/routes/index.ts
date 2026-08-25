import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campusQueryRouter from "./campusquery";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campusQueryRouter);

export default router;
