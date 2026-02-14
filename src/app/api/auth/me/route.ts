import { readSessionValue, sessionCookieName } from "@/lib/telegram-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(sessionCookieName())?.value;
  const user = readSessionValue(raw);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
