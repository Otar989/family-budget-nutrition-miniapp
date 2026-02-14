"use client";

import { useEffect, useMemo, useState } from "react";
import { initTelegramWebApp } from "@/lib/telegram";
import type { Allergy, FamilyMember, PlanPeriod, PlanResponse } from "@/types";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

type TabId = "plan" | "meals" | "cart" | "profile";
type ThemeMode = "light" | "dark";

const ALLERGIES: Array<{ value: Allergy; label: string }> = [
  { value: "nuts", label: "Орехи" },
  { value: "lactose", label: "Лактоза" },
  { value: "gluten", label: "Глютен" },
  { value: "seafood", label: "Морепродукты" },
  { value: "eggs", label: "Яйца" },
  { value: "soy", label: "Соя" },
];

const PERIODS: Array<{ value: PlanPeriod; label: string }> = [
  { value: "dinner", label: "Ужин" },
  { value: "day", label: "День" },
  { value: "month", label: "Месяц" },
];

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "plan", label: "План", icon: "◉" },
  { id: "meals", label: "Рацион", icon: "◌" },
  { id: "cart", label: "Корзина", icon: "◎" },
  { id: "profile", label: "Профиль", icon: "◍" },
];

function createMember(index: number): FamilyMember {
  return {
    id: crypto.randomUUID(),
    name: index === 0 ? "Папа" : index === 1 ? "Мама" : `Ребенок ${index - 1}`,
    ageGroup: index < 2 ? "adult" : "child",
    allergies: [],
  };
}

export default function Home() {
  const [tab, setTab] = useState<TabId>("plan");
  const [period, setPeriod] = useState<PlanPeriod>("day");
  const [budget, setBudget] = useState<number>(4000);
  const [family, setFamily] = useState<FamilyMember[]>([createMember(0), createMember(1)]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "error">("checking");
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    links: Array<{ storeName: string; checkoutUrl: string }>;
  } | null>(null);

  useEffect(() => {
    const apply = (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
      document.documentElement.setAttribute("data-theme", nextTheme);
    };

    const tg = initTelegramWebApp();
    const initial = tg?.colorScheme === "dark" ? "dark" : "light";
    apply(initial);

    const initData = tg?.initData;

    const runAuth = async () => {
      try {
        const meResponse = await fetch("/api/auth/me");
        if (meResponse.ok) {
          const meData = await meResponse.json();
          setTelegramUser(meData.user);
          setAuthStatus("ok");
          return;
        }

        if (!initData) {
          throw new Error("Откройте приложение из Telegram для авторизации.");
        }

        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Ошибка авторизации");
        }

        setTelegramUser(data.user);
        setAuthStatus("ok");
      } catch (authError) {
        setAuthStatus("error");
        setError(authError instanceof Error ? authError.message : "Ошибка авторизации");
      }
    };

    void runAuth();
  }, []);

  const monthlyHint = useMemo(() => {
    if (period !== "month") {
      return null;
    }
    return `Для режима "Месяц" рекомендуемый бюджет: от ${Math.round(family.length * 9000).toLocaleString("ru-RU")} грн.`;
  }, [family.length, period]);

  const updateMember = (id: string, patch: Partial<FamilyMember>) => {
    setFamily((current) =>
      current.map((member) =>
        member.id === id
          ? {
              ...member,
              ...patch,
            }
          : member,
      ),
    );
  };

  const toggleAllergy = (id: string, allergy: Allergy) => {
    setFamily((current) =>
      current.map((member) => {
        if (member.id !== id) {
          return member;
        }

        const has = member.allergies.includes(allergy);
        return {
          ...member,
          allergies: has
            ? member.allergies.filter((item) => item !== allergy)
            : [...member.allergies, allergy],
        };
      }),
    );
  };

  const buildPlan = async () => {
    setLoading(true);
    setError(null);
    setOrderResult(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          budget,
          family,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сформировать рацион");
      }

      setPlan(data);
      setTab("meals");
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async () => {
    if (!plan?.cart?.length) {
      return;
    }

    setOrderLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: plan.cart }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось создать черновик заказа");
      }

      setOrderResult({
        orderId: data.orderId,
        links: data.orderLinks,
      });
      setTab("cart");
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Ошибка заказа");
    } finally {
      setOrderLoading(false);
    }
  };

  const switchTheme = () => {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="hero glass-card">
          <div className="hero-topline">
            <p className="eyebrow">Telegram Mini App</p>
            <button type="button" className="theme-toggle" onClick={switchTheme}>
              {theme === "dark" ? "Светлая тема" : "Темная тема"}
            </button>
          </div>
          <h1>План питания по бюджету</h1>
          <p>
            Сервис подбирает рацион под бюджет семьи, учитывает аллергии каждого члена семьи,
            показывает рецепты и магазины для покупки.
          </p>
          <div className="auth-pill">
            {authStatus === "checking" ? "Проверка Telegram-авторизации..." : null}
            {authStatus === "ok" && telegramUser
              ? `Вы вошли как ${telegramUser.first_name}${telegramUser.username ? ` (@${telegramUser.username})` : ""}`
              : null}
            {authStatus === "error" ? "Ошибка авторизации Telegram" : null}
          </div>
        </section>

        <section className="content glass-card">
          {tab === "plan" ? (
            <>
              <h2>Параметры плана</h2>
              <div className="input-grid">
                <label>
                  Бюджет (грн)
                  <input
                    type="number"
                    min={100}
                    value={budget}
                    onChange={(event) => setBudget(Number(event.target.value))}
                  />
                </label>
                <label>
                  Период
                  <select value={period} onChange={(event) => setPeriod(event.target.value as PlanPeriod)}>
                    {PERIODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {monthlyHint ? <p className="subtle">{monthlyHint}</p> : null}

              <div className="section-head">
                <h3>Состав семьи</h3>
                <button
                  className="soft-btn"
                  type="button"
                  onClick={() => setFamily((current) => [...current, createMember(current.length)])}
                >
                  Добавить
                </button>
              </div>

              <div className="family-list">
                {family.map((member, index) => (
                  <article className="member-card" key={member.id}>
                    <div className="member-row">
                      <input
                        value={member.name}
                        onChange={(event) => updateMember(member.id, { name: event.target.value })}
                        aria-label="Имя"
                      />
                      <select
                        value={member.ageGroup}
                        onChange={(event) =>
                          updateMember(member.id, {
                            ageGroup: event.target.value as FamilyMember["ageGroup"],
                          })
                        }
                      >
                        <option value="adult">Взрослый</option>
                        <option value="teen">Подросток</option>
                        <option value="child">Ребенок</option>
                      </select>
                      {family.length > 1 ? (
                        <button
                          className="danger-btn"
                          type="button"
                          onClick={() =>
                            setFamily((current) => current.filter((item) => item.id !== member.id))
                          }
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                    <div className="chips">
                      {ALLERGIES.map((item) => {
                        const active = member.allergies.includes(item.value);
                        return (
                          <button
                            key={`${member.id}-${item.value}`}
                            type="button"
                            className={`chip ${active ? "chip-active" : ""}`}
                            onClick={() => toggleAllergy(member.id, item.value)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                    <small>Участник #{index + 1}</small>
                  </article>
                ))}
              </div>

              <button className="primary-btn" type="button" onClick={buildPlan} disabled={loading}>
                {loading ? "Считаем рацион..." : "Подобрать рацион"}
              </button>
            </>
          ) : null}

          {tab === "meals" ? (
            <>
              <div className="section-head">
                <h2>Рекомендованный рацион</h2>
                {plan ? (
                  <span>
                    {Math.round(plan.totalEstimated).toLocaleString("ru-RU")} грн из {plan.budget.toLocaleString("ru-RU")} грн
                  </span>
                ) : null}
              </div>
              {!plan ? <p className="subtle">Сначала соберите план на вкладке «План».</p> : null}
              {plan ? (
                <div className="meals-grid">
                  {plan.meals.map((entry) => (
                    <article key={entry.meal.id} className="tile">
                      <h3>{entry.meal.title}</h3>
                      <p>{entry.meal.description}</p>
                      <p>
                        Повторений: <b>{entry.times}</b> • Время: <b>{entry.meal.minutes} мин</b>
                      </p>
                      <p>
                        Оценка стоимости: <b>{Math.round(entry.estimatedTotal)} грн</b>
                      </p>
                      <ol>
                        {entry.meal.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "cart" ? (
            <>
              <div className="section-head">
                <h2>Корзина и магазины</h2>
                <button
                  type="button"
                  className="primary-btn inline"
                  onClick={createOrder}
                  disabled={!plan || orderLoading}
                >
                  {orderLoading ? "Создаем..." : "Оформить черновик"}
                </button>
              </div>

              {!plan ? <p className="subtle">Нет корзины. Сначала сгенерируйте рацион.</p> : null}

              {plan ? (
                <div className="store-grid">
                  {plan.stores.map((store) => (
                    <article key={store.store.id} className="tile">
                      <div className="row-between">
                        <h3>{store.store.name}</h3>
                        <b>{Math.round(store.subtotal)} грн</b>
                      </div>
                      <ul>
                        {store.items.map((item) => (
                          <li key={`${store.store.id}-${item.productName}`}>
                            {item.productName}: {item.quantity} {item.unit}
                          </li>
                        ))}
                      </ul>
                      <a href={store.store.checkoutUrl} target="_blank" rel="noreferrer">
                        Перейти в {store.store.name}
                      </a>
                    </article>
                  ))}
                </div>
              ) : null}

              {orderResult ? (
                <div className="tile order-box">
                  <h3>Черновик заказа #{orderResult.orderId}</h3>
                  {orderResult.links.map((link) => (
                    <a key={link.storeName} href={link.checkoutUrl} target="_blank" rel="noreferrer">
                      Открыть checkout в {link.storeName}
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "profile" ? (
            <>
              <h2>Профиль</h2>
              {telegramUser ? (
                <article className="tile profile-tile">
                  <div>
                    <p>
                      <b>{telegramUser.first_name}</b>
                      {telegramUser.last_name ? ` ${telegramUser.last_name}` : ""}
                    </p>
                    <p>ID: {telegramUser.id}</p>
                    <p>{telegramUser.username ? `@${telegramUser.username}` : "Без username"}</p>
                  </div>
                  <div className="avatar-fallback">
                    {telegramUser.first_name.slice(0, 1)}
                    {telegramUser.last_name?.slice(0, 1) ?? ""}
                  </div>
                </article>
              ) : (
                <p className="subtle">Авторизуйте приложение через Telegram, чтобы увидеть профиль.</p>
              )}
              <p className="subtle">
                Авторизация выполняется по Telegram initData с серверной проверкой подписи.
              </p>
            </>
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
          {plan?.notes?.length ? (
            <div className="notes">
              {plan.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      <nav className="tabbar glass-card">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
