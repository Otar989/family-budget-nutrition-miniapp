import {
  createSessionValue,
  sessionCookieName,
  sessionMaxAge,
  validateTelegramInitData,
} from "@/lib/telegram-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

interface Body {
  initData: string;
}

export async function POST(request: Request) {
  try {
    const { initData } = (await request.json()) as Body;

    if (!initData) {
      return NextResponse.json({ error: "initData обязателен." }, { status: 400 });
    }

    const { user } = validateTelegramInitData(initData);

    if (supabaseAdmin) {
      await supabaseAdmin.from("telegram_users").upsert(
        {
          telegram_id: user.id,
          username: user.username ?? null,
          first_name: user.first_name,
          last_name: user.last_name ?? null,
          language_code: user.language_code ?? null,
          photo_url: user.photo_url ?? null,
          last_login_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" },
      );
    }

    const response = NextResponse.json({ user, ok: true });
    response.cookies.set(sessionCookieName(), createSessionValue(user), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: sessionMaxAge(),
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось авторизоваться через Telegram.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
