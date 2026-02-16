import { Router } from "express";
import { z } from "zod";
import { createSimAdminLink, requireAdmin, updateEventState, validateAdminToken } from "../services/adminService";

export const adminRouter = Router();

const simAdminLinkSchema = z.object({
  eventCode: z.string().min(1)
});

const codeParamSchema = z.object({
  code: z.string().min(1)
});

const tokenQuerySchema = z.object({
  event_code: z.string().min(1),
  admin_token: z.string().min(1)
});

adminRouter.post("/sim-admin-link", async (req, res, next) => {
  try {
    const adminUserId = await requireAdmin(req.headers["x-user-id"] as string | undefined);
    const { eventCode } = simAdminLinkSchema.parse(req.body);
    const result = await createSimAdminLink(eventCode, adminUserId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/start", async (req, res, next) => {
  try {
    await requireAdmin(req.headers["x-user-id"] as string | undefined);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "start");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/pause", async (req, res, next) => {
  try {
    await requireAdmin(req.headers["x-user-id"] as string | undefined);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "pause");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/resume", async (req, res, next) => {
  try {
    await requireAdmin(req.headers["x-user-id"] as string | undefined);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "resume");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.post("/events/:code/end", async (req, res, next) => {
  try {
    await requireAdmin(req.headers["x-user-id"] as string | undefined);
    const { code } = codeParamSchema.parse(req.params);
    const result = await updateEventState(code, "end");
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

adminRouter.get("/validate-token", (req, res, next) => {
  try {
    const { event_code, admin_token } = tokenQuerySchema.parse(req.query);
    const result = validateAdminToken(event_code, admin_token);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});
