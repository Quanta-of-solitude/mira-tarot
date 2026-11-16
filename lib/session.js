import { auth } from "@/auth";
import { getUser, upsertUser } from "./store";

const admins = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// The signed-in user with live credits from the store, or null.
export async function currentUser() {
  const s = await auth();
  const email = s?.user?.email?.toLowerCase();
  if (!email) return null;
  let u = s.user.id ? await getUser(s.user.id) : null;
  if (!u) u = await upsertUser({ email, name: s.user.name, image: s.user.image });
  return { ...u, isAdmin: admins().includes(u.email) };
}

export const json = (data, status = 200) => Response.json(data, { status });
