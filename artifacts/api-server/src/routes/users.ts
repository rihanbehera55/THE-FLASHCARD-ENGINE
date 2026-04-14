import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody } from "@workspace/api-zod";
import crypto from "crypto";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { email, name, password } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      streakDays: user.streakDays,
    });
    return;
  }

  let passwordHash: string | undefined;
  if (password) {
    passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  }

  const [user] = await db
    .insert(usersTable)
    .values({ email, name, passwordHash })
    .returning();

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
    streakDays: user.streakDays,
  });
});

export default router;
