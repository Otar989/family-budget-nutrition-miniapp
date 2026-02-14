import crypto from "crypto";

const SESSION_COOKIE = "tg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface InitDataParsed {
  user: TelegramUser;
  authDate: number;
}

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN не задан в окружении.");
  }
  return token;
}

function getSessionSecret() {
  return process.env.TELEGRAM_SESSION_SECRET || getBotToken();
}

export function validateTelegramInitData(initData: string): InitDataParsed {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");

  if (!hash || !authDateRaw || !userRaw) {
    throw new Error("Некорректные данные Telegram авторизации.");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(getBotToken()).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (calculated !== hash) {
    throw new Error("Подпись Telegram не прошла проверку.");
  }

  const authDate = Number(authDateRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || now - authDate > 60 * 60 * 24) {
    throw new Error("Данные авторизации Telegram устарели. Откройте приложение заново.");
  }

  const user = JSON.parse(userRaw) as TelegramUser;
  if (!user?.id) {
    throw new Error("Пользователь Telegram не определен.");
  }

  return { user, authDate };
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

export function createSessionValue(user: TelegramUser) {
  const payload = JSON.stringify({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code,
    photo_url: user.photo_url,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  const base = Buffer.from(payload, "utf8").toString("base64url");
  const sig = signPayload(base);
  return `${base}.${sig}`;
}

export function readSessionValue(rawCookie?: string | null): TelegramUser | null {
  if (!rawCookie) {
    return null;
  }

  const [base, sig] = rawCookie.split(".");
  if (!base || !sig || signPayload(base) !== sig) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as TelegramUser & {
      exp: number;
    };

    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: parsed.id,
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      username: parsed.username,
      language_code: parsed.language_code,
      photo_url: parsed.photo_url,
    };
  } catch {
    return null;
  }
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function sessionMaxAge() {
  return SESSION_TTL_SECONDS;
}
