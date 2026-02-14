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

const ALLERGIES: Array<{ value: Allergy; label: string; icon: string }> = [
  { value: "nuts", label: "Орехи", icon: "\uD83E\uDD5C" },
  { value: "lactose", label: "Лактоза", icon: "\uD83E\uDD5B" },
  { value: "gluten", label: "Глютен", icon: "\uD83C\uDF3E" },
  { value: "seafood", label: "Морепродукты", icon: "\uD83E\uDD90" },
  { value: "eggs", label: "Яйца", icon: "\uD83E\uDD5A" },
  { value: "soy", label: "Соя", icon: "\uD83C\uDF31" },
];

const PERIODS: Array<{ value: PlanPeriod; label: string; icon: string; desc: string }> = [
  { value: "dinner", label: "Ужин", icon: "\uD83C\uDF19", desc: "1 прием" },
  { value: "day", label: "День", icon: "\u2600\uFE0F", desc: "3 приема" },
  { value: "month", label: "Месяц", icon: "\uD83D\uDCC5", desc: "90 приемов" },
];

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "plan", label: "План", icon: "\uD83C\uDFAF" },
  { id: "meals", label: "Рацион", icon: "\uD83C\uDF72" },
  { id: "cart", label: "Корзина", icon: "\uD83D\uDED2" },
  { id: "profile", label: "Профиль", icon: "\uD83D\uDC64" },
];

const AGE_GROUPS: Array<{ value: FamilyMember["ageGroup"]; label: string }> = [
  { value: "adult", label: "Взрослый" },
  { value: "teen", label: "Подросток" },
  { value: "child", label: "Ребенок" },
];

const MEMBER_EMOJIS: Record<string, string> = {
  adult: "\uD83E\uDDD1",
  teen: "\uD83E\uDDD2",
  child: "\uD83D\uDC76",
};

const MEAL_EMOJIS: Record<string, string> = {
  "chicken-rice-bowl": "\uD83C\uDF5B",
  "lentil-tomato-soup": "\uD83C\uDF72",
  "egg-pasta": "\uD83C\uDF5D",
  "salmon-potato-plate": "\uD83E\uDD69",
  "yogurt-fruit-breakfast": "\uD83E\uDD63",
  "buckwheat-chicken": "\uD83C\uDF5A",
  "potato-lentil-stew": "\uD83E\uDD58",
};

const STORE_EMOJIS: Record<string, string> = {
  silpo: "\uD83D\uDFE2",
  atb: "\uD83D\uDD35",
  metro: "\uD83D\uDFE0",
};

function createMember(index: number): FamilyMember {
  return {
    id: crypto.randomUUID(),
    name: index === 0 ? "Папа" : index === 1 ? "Мама" : `Ребенок ${index - 1}`,
    ageGroup: index < 2 ? "adult" : "child",
    allergies: [],
  };
}

function getBudgetRange(period: PlanPeriod): { min: number; max: number; step: number } {
  switch (period) {
    case "dinner":
      return { min: 100, max: 3000, step: 50 };
    case "day":
      return { min: 300, max: 8000, step: 100 };
    case "month":
      return { min: 5000, max: 80000, step: 500 };
  }
}

function getDefaultBudget(period: PlanPeriod): number {
  switch (period) {
    case "dinner":
      return 800;
    case "day":
      return 2500;
    case "month":
      return 30000;
  }
}

export default function Home() {
  const [tab, setTab] = useState<TabId>("plan");
  const [period, setPeriod] = useState<PlanPeriod>("day");
  const [budget, setBudget] = useState<number>(2500);
  const [family, setFamily] = useState<FamilyMember[]>([createMember(0), createMember(1)]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "error">("checking");
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    links: Array<{ storeName: string; checkoutUrl: string }>;
  } | null>(null);

  useEffect(() => {
    const tg = initTelegramWebApp();

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
          setAuthStatus("ok");
          return;
        }

        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Auth error");
        }

        setTelegramUser(data.user);
        setAuthStatus("ok");
      } catch {
        setAuthStatus("ok");
      }
    };

    void runAuth();
  }, []);

  const budgetRange = useMemo(() => getBudgetRange(period), [period]);

  const handlePeriodChange = (newPeriod: PlanPeriod) => {
    setPeriod(newPeriod);
    setBudget(getDefaultBudget(newPeriod));
  };

  const updateMember = (id: string, patch: Partial<FamilyMember>) => {
    setFamily((cur) => cur.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const toggleAllergy = (id: string, allergy: Allergy) => {
    setFamily((cur) =>
      cur.map((m) => {
        if (m.id !== id) return m;
        const has = m.allergies.includes(allergy);
        return { ...m, allergies: has ? m.allergies.filter((a) => a !== allergy) : [...m.allergies, allergy] };
      }),
    );
  };

  const toggleMealExpand = (mealId: string) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  };

  const buildPlan = async () => {
    setLoading(true);
    setError(null);
    setOrderResult(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, budget, family }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сформировать рацион");

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
    if (!plan?.cart?.length) return;
    setOrderLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: plan.cart }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка заказа");

      setOrderResult({ orderId: data.orderId, links: data.orderLinks });
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Ошибка заказа");
    } finally {
      setOrderLoading(false);
    }
  };

  const budgetPct = plan ? Math.min((plan.totalEstimated / plan.budget) * 100, 100) : 0;
  const isOverBudget = plan ? plan.totalEstimated > plan.budget : false;

  const userName = telegramUser?.first_name ?? "Гость";

  return (
    <div className="app-shell">
      <main className="app-main">
        {/* ═══ HERO ═══ */}
        <section className="hero">
          <div className="hero-topline">
            <p className="hero-greeting">
              {telegramUser ? (
                <>
                  {"\uD83D\uDC4B"} <strong>{userName}</strong>
                </>
              ) : (
                "\uD83C\uDF7D\uFE0F Plan & Eat"
              )}
            </p>
          </div>
          <h1>{"\uD83E\uDD57"} Умный план питания</h1>
          <p className="hero-subtitle">
            Подберем рацион под бюджет, учтем аллергии и покажем где купить дешевле
          </p>
        </section>

        {/* ═══ STATS ROW ═══ */}
        {plan ? (
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-icon">{"\uD83C\uDF72"}</span>
              <span className="stat-value">{plan.meals.length}</span>
              <span className="stat-label">Блюд</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">{"\uD83D\uDCB0"}</span>
              <span className="stat-value">{Math.round(plan.totalEstimated).toLocaleString("ru-RU")}</span>
              <span className="stat-label">Грн</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">{"\uD83C\uDFEA"}</span>
              <span className="stat-value">{plan.stores.length}</span>
              <span className="stat-label">Магазинов</span>
            </div>
          </div>
        ) : null}

        {/* ═══ TAB CONTENT ═══ */}
        <section className="content-section">
          {/* ─── PLAN TAB ─── */}
          {tab === "plan" ? (
            <>
              {/* Budget display */}
              <div className="card animate-fade-up">
                <h3 className="section-title">
                  <span className="section-title-icon">{"\uD83D\uDCB3"}</span>
                  Бюджет
                </h3>
                <div className="budget-display">
                  <span className="budget-amount">
                    {budget.toLocaleString("ru-RU")}
                    <span className="budget-currency"> грн</span>
                  </span>
                </div>
                <input
                  type="range"
                  className="budget-slider"
                  min={budgetRange.min}
                  max={budgetRange.max}
                  step={budgetRange.step}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
                <div className="budget-range-labels">
                  <span>{budgetRange.min.toLocaleString("ru-RU")}</span>
                  <span>{budgetRange.max.toLocaleString("ru-RU")}</span>
                </div>
              </div>

              {/* Period selection */}
              <div className="animate-fade-up delay-1">
                <h3 className="section-title" style={{ marginBottom: 10 }}>
                  <span className="section-title-icon">{"\u23F0"}</span>
                  Период
                </h3>
                <div className="period-pills">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`period-pill ${period === p.value ? "period-pill-active" : ""}`}
                      onClick={() => handlePeriodChange(p.value)}
                    >
                      <span className="period-pill-icon">{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Family */}
              <div className="animate-fade-up delay-2">
                <div className="family-section-head" style={{ marginBottom: 10 }}>
                  <h3 className="section-title">
                    <span className="section-title-icon">{"\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66"}</span>
                    Семья
                  </h3>
                  <button
                    type="button"
                    className="add-member-btn"
                    onClick={() => setFamily((cur) => [...cur, createMember(cur.length)])}
                  >
                    + Добавить
                  </button>
                </div>

                <div className="family-list">
                  {family.map((member) => (
                    <article className="member-card" key={member.id}>
                      <div className="member-header">
                        <div className="member-emoji">{MEMBER_EMOJIS[member.ageGroup]}</div>
                        <div className="member-fields">
                          <input
                            className="member-name-input"
                            value={member.name}
                            onChange={(e) => updateMember(member.id, { name: e.target.value })}
                            placeholder="Имя"
                          />
                          <div className="member-age-row">
                            {AGE_GROUPS.map((ag) => (
                              <button
                                key={ag.value}
                                type="button"
                                className={`age-pill ${member.ageGroup === ag.value ? "age-pill-active" : ""}`}
                                onClick={() => updateMember(member.id, { ageGroup: ag.value })}
                              >
                                {ag.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {family.length > 1 ? (
                          <button
                            type="button"
                            className="remove-member-btn"
                            onClick={() => setFamily((cur) => cur.filter((m) => m.id !== member.id))}
                          >
                            {"\u2715"}
                          </button>
                        ) : null}
                      </div>

                      <div className="chips">
                        {ALLERGIES.map((a) => {
                          const active = member.allergies.includes(a.value);
                          return (
                            <button
                              key={`${member.id}-${a.value}`}
                              type="button"
                              className={`chip ${active ? "chip-active" : ""}`}
                              onClick={() => toggleAllergy(member.id, a.value)}
                            >
                              {a.icon} {a.label}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* Build button */}
              <button
                className={`primary-btn animate-fade-up delay-3 ${loading ? "primary-btn-loading" : ""}`}
                type="button"
                onClick={buildPlan}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Подбираем рацион...
                  </>
                ) : (
                  <>{"\uD83D\uDE80"} Подобрать рацион</>
                )}
              </button>
            </>
          ) : null}

          {/* ─── MEALS TAB ─── */}
          {tab === "meals" ? (
            <>
              {!plan ? (
                <div className="empty-state">
                  <span className="empty-icon">{"\uD83C\uDF73"}</span>
                  <p className="empty-text">Рацион пока не составлен</p>
                  <p className="empty-hint">Перейдите в &laquo;План&raquo; и нажмите &laquo;Подобрать рацион&raquo;</p>
                </div>
              ) : (
                <>
                  {/* Budget progress bar */}
                  <div className="budget-bar-wrap animate-fade-up">
                    <div className="budget-bar-header">
                      <span className="budget-bar-spent">
                        {Math.round(plan.totalEstimated).toLocaleString("ru-RU")} грн
                      </span>
                      <span className="budget-bar-total">
                        из {plan.budget.toLocaleString("ru-RU")} грн
                      </span>
                    </div>
                    <div className="budget-bar-track">
                      <div
                        className={`budget-bar-fill ${isOverBudget ? "budget-bar-fill-over" : ""}`}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  </div>

                  <h3 className="section-title animate-fade-up delay-1">
                    <span className="section-title-icon">{"\uD83C\uDF7D\uFE0F"}</span>
                    Рекомендованные блюда
                  </h3>

                  <div className="meals-list">
                    {plan.meals.map((entry, i) => (
                      <article
                        key={entry.meal.id}
                        className={`meal-card animate-fade-up delay-${Math.min(i + 1, 5)}`}
                      >
                        <div className="meal-card-header">
                          <span className="meal-emoji">{MEAL_EMOJIS[entry.meal.id] ?? "\uD83C\uDF5E"}</span>
                          <div className="meal-info">
                            <span className="meal-title">{entry.meal.title}</span>
                            <span className="meal-desc">{entry.meal.description}</span>
                          </div>
                          <span className="meal-cost-badge">{Math.round(entry.estimatedTotal)} грн</span>
                        </div>

                        <div className="meal-meta">
                          <span className="meal-meta-item">{"\u23F1"} {entry.meal.minutes} мин</span>
                          <span className="meal-meta-item">{"\uD83D\uDD01"} {entry.times}x</span>
                          {entry.meal.tags.map((tag) => (
                            <span key={tag} className="meal-meta-item">#{tag}</span>
                          ))}
                        </div>

                        <div className="meal-steps">
                          <button
                            type="button"
                            className="meal-steps-toggle"
                            onClick={() => toggleMealExpand(entry.meal.id)}
                          >
                            {expandedMeals.has(entry.meal.id) ? "\uD83D\uDC40 Скрыть рецепт" : "\uD83D\uDCD6 Показать рецепт"}
                          </button>
                          {expandedMeals.has(entry.meal.id) ? (
                            <ol>
                              {entry.meal.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}

          {/* ─── CART TAB ─── */}
          {tab === "cart" ? (
            <>
              {!plan ? (
                <div className="empty-state">
                  <span className="empty-icon">{"\uD83D\uDED2"}</span>
                  <p className="empty-text">Корзина пуста</p>
                  <p className="empty-hint">Сначала составьте план питания</p>
                </div>
              ) : (
                <>
                  <h3 className="section-title animate-fade-up">
                    <span className="section-title-icon">{"\uD83C\uDFEA"}</span>
                    Покупки по магазинам
                  </h3>

                  <div className="store-list">
                    {plan.stores.map((store, i) => (
                      <article
                        key={store.store.id}
                        className={`store-card animate-fade-up delay-${Math.min(i + 1, 5)}`}
                      >
                        <div className="store-card-header">
                          <span className="store-name">
                            {STORE_EMOJIS[store.store.id] ?? "\uD83C\uDFEA"} {store.store.name}
                          </span>
                          <span className="store-badge">{Math.round(store.subtotal)} грн</span>
                        </div>
                        <div className="store-items">
                          {store.items.map((item) => (
                            <div key={`${store.store.id}-${item.productName}`} className="store-item">
                              <span>{item.productName} ({item.quantity} {item.unit})</span>
                              <span className="store-item-price">{Math.round(item.price)} грн</span>
                            </div>
                          ))}
                        </div>
                        <a
                          href={store.store.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="store-link"
                        >
                          {"\uD83D\uDED2"} Перейти в {store.store.name} {"\u2192"}
                        </a>
                      </article>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`primary-btn ${orderLoading ? "primary-btn-loading" : ""}`}
                    onClick={createOrder}
                    disabled={orderLoading}
                  >
                    {orderLoading ? (
                      <>
                        <span className="spinner" /> Оформляем...
                      </>
                    ) : (
                      <>{"\u2705"} Оформить черновик заказа</>
                    )}
                  </button>

                  {orderResult ? (
                    <div className="order-box animate-fade-up">
                      <h3>{"\uD83C\uDF89"} Заказ #{orderResult.orderId}</h3>
                      {orderResult.links.map((link) => (
                        <a
                          key={link.storeName}
                          href={link.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="order-link-btn"
                        >
                          {"\uD83D\uDED2"} Checkout {link.storeName}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {/* ─── PROFILE TAB ─── */}
          {tab === "profile" ? (
            <>
              {telegramUser ? (
                <div className="profile-card animate-fade-up">
                  <div className="profile-avatar">
                    {telegramUser.first_name.slice(0, 1)}
                    {telegramUser.last_name?.slice(0, 1) ?? ""}
                  </div>
                  <div className="profile-info">
                    <span className="profile-name">
                      {telegramUser.first_name} {telegramUser.last_name ?? ""}
                    </span>
                    {telegramUser.username ? (
                      <span className="profile-username">@{telegramUser.username}</span>
                    ) : null}
                    <span className="profile-id">ID: {telegramUser.id}</span>
                  </div>
                </div>
              ) : (
                <div className="profile-card animate-fade-up">
                  <div className="profile-avatar">{"\uD83D\uDC64"}</div>
                  <div className="profile-info">
                    <span className="profile-name">Гость</span>
                    <span className="profile-id">Откройте через Telegram для авторизации</span>
                  </div>
                </div>
              )}

              <div className="menu-list animate-fade-up delay-1">
                <div className="menu-item">
                  <span className="menu-icon">{"\uD83C\uDF72"}</span>
                  <div className="menu-text">
                    <div className="menu-title">Каталог блюд</div>
                    <div className="menu-desc">7 рецептов на любой бюджет</div>
                  </div>
                  <span className="menu-arrow">{"\u203A"}</span>
                </div>
                <div className="menu-item">
                  <span className="menu-icon">{"\uD83C\uDFEA"}</span>
                  <div className="menu-text">
                    <div className="menu-title">Магазины</div>
                    <div className="menu-desc">Сравниваем цены в 3 сетях</div>
                  </div>
                  <span className="menu-arrow">{"\u203A"}</span>
                </div>
                <div className="menu-item">
                  <span className="menu-icon">{"\u2764\uFE0F"}</span>
                  <div className="menu-text">
                    <div className="menu-title">Подписка Pro</div>
                    <div className="menu-desc">Персональные планы, больше рецептов</div>
                  </div>
                  <span className="menu-arrow">{"\u203A"}</span>
                </div>
                <div className="menu-item">
                  <span className="menu-icon">{"\u2753"}</span>
                  <div className="menu-text">
                    <div className="menu-title">Помощь</div>
                    <div className="menu-desc">Часто задаваемые вопросы</div>
                  </div>
                  <span className="menu-arrow">{"\u203A"}</span>
                </div>
              </div>

              <p className="subtle" style={{ textAlign: "center", padding: "8px 0" }}>
                {authStatus === "checking" ? "Проверяем авторизацию..." : null}
                {authStatus === "ok" && telegramUser
                  ? "\u2705 Авторизация подтверждена"
                  : authStatus === "ok"
                    ? "Откройте через бот для полного доступа"
                    : null}
              </p>
            </>
          ) : null}

          {/* ─── Errors & Notes ─── */}
          {error ? <p className="error-text">{"\u26A0\uFE0F"} {error}</p> : null}
          {plan?.notes?.length ? (
            <div className="notes-box">
              {plan.notes.map((note) => (
                <p key={note}>{"\uD83D\uDCDD"} {note}</p>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      {/* ═══ TAB BAR ═══ */}
      <nav className="tabbar">
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
