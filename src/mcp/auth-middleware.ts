import type { RequestHandler } from "express";

export function bearerAuth(expectedToken: string): RequestHandler {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${expectedToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
