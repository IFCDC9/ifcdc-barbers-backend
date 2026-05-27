/**
 * AURA chat history — per-user message list and cleanup (hard delete; not financial data).
 */
import express from "express";
import { dbQuery } from "./db.js";
import { writeSecurityAudit } from "./auditSecurity.js";

/**
 * @param {{ requireAuth: import("express").RequestHandler }} deps
 */
export function createAuraChatHistoryRouter({ requireAuth }) {
  const router = express.Router();

  router.get("/messages", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "").trim();
      if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

      const r = await dbQuery(
        `SELECT id, role, content, created_at
         FROM aura_chat_messages
         WHERE user_id = $1::uuid
         ORDER BY created_at ASC
         LIMIT 200`,
        [userId],
      );
      return res.json({ ok: true, messages: r.rows || [] });
    } catch (e) {
      console.error("[aura] GET messages failed:", e?.message || e);
      return res.status(500).json({ ok: false, message: "Could not load chat history" });
    }
  });

  router.delete("/messages/:id", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "").trim();
      const id = String(req.params.id || "").trim();
      if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });
      if (!id) return res.status(400).json({ ok: false, message: "Message id required" });

      const r = await dbQuery(
        `DELETE FROM aura_chat_messages WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
        [id, userId],
      );
      if (!r.rows?.length) {
        return res.status(404).json({ ok: false, message: "Message not found" });
      }

      void writeSecurityAudit({
        eventType: "message_deleted",
        actorUserId: userId,
        actorEmail: req.user?.email || null,
        req,
        metadata: { messageId: id, action: "message_deleted" },
      });

      return res.json({ ok: true, deleted: true });
    } catch (e) {
      console.error("[aura] DELETE message failed:", e?.message || e);
      return res.status(500).json({ ok: false, message: "Could not delete message" });
    }
  });

  router.delete("/messages", requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id || "").trim();
      if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

      const r = await dbQuery(`DELETE FROM aura_chat_messages WHERE user_id = $1::uuid`, [userId]);

      void writeSecurityAudit({
        eventType: "message_deleted",
        actorUserId: userId,
        actorEmail: req.user?.email || null,
        req,
        metadata: {
          action: "conversation_cleared",
          deletedCount: r.rowCount ?? null,
        },
      });

      return res.json({ ok: true, cleared: true, count: r.rowCount ?? 0 });
    } catch (e) {
      console.error("[aura] DELETE messages failed:", e?.message || e);
      return res.status(500).json({ ok: false, message: "Could not clear conversation" });
    }
  });

  return router;
}
