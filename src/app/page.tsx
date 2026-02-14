"use client";

import { useEffect, useState, useCallback } from "react";
import { initTelegramWebApp } from "@/lib/telegram";
import type {
  PlanPeriod,
  Allergy,
  FamilyMember,
  DietPref,
  PlanResponse,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: PlanPeriod; label: string; icon: string }[] = [
  { value: "meal", label: "Один приём", icon: "🍽" },
  { value: "day", label: "День", icon: "☀️" },
  { value: "week", label: "Неделя", icon: "📅" },
  { value: "month", label: "Месяц", icon: "🗓" },
];

const BUDGET_CONFIG: Record<
  PlanPeriod,
  { min: number; max: number; step: number; default: number }
> = {
  meal: { min: 200, max: 2000, step: 50, default: 600 },
  day: { min: 500, max: 5000, step: 100, default: 1500 },
  week: { min: 3000, max: 30000, step: 500, default: 8000 },
  month: { min: 10000, max: 100000, step: 1000, default: 30000 },
};

const ALLERGY_OPTIONS: { value: Allergy; label: string }[] = [
  { value: "nuts", label: "🥜 Орехи" },
  { value: "lactose", label: "🥛 Лактоза" },
  { value: "gluten", label: "🌾 Глютен" },
  { value: "seafood", label: "🦐 Морепродукты" },
  { value: "eggs", label: "🥚 Яйца" },
  { value: "soy", label: "🫘 Соя" },
];

const DIET_OPTIONS: {
  value: DietPref;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "classic", label: "Классика", icon: "🍖", desc: "Привычная домашняя еда" },
  { value: "healthy", label: "Здоровое", icon: "🥗", desc: "Сбалансированный рацион" },
  { value: "vegetarian", label: "Вегетарианское", icon: "🌿", desc: "Без мяса и рыбы" },
  { value: "budget", label: "Бюджетное", icon: "💰", desc: "Максимальная экономия" },
];

const AGE_GROUP_OPTIONS: {
  value: FamilyMember["ageGroup"];
  label: string;
  icon: string;
}[] = [
  { value: "adult", label: "Взрослый", icon: "👤" },
  { value: "teen", label: "Подросток", icon: "🧑" },
  { value: "child", label: "Ребёнок", icon: "👶" },
];

const MEMBER_EMOJIS = ["😊", "👩", "👨", "👦", "👧", "🧑", "👴", "👵", "🧒"];

const MEAL_EMOJI_MAP: Record<string, string> = {
  breakfast: "🌅",
  lunch: "🥘",
  dinner: "🍽",
  salad: "🥗",
  soup: "🍲",
  pasta: "🍝",
  rice: "🍚",
  meat: "🥩",
  fish: "🐟",
  chicken: "🍗",
};

function getMealEmoji(mealId: string): string {
  const key = Object.keys(MEAL_EMOJI_MAP).find((k) =>
    mealId.toLowerCase().includes(k)
  );
  return key ? MEAL_EMOJI_MAP[key] : "🍴";
}

function formatRub(amount: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(amount));
}

// ─── Local Types ──────────────────────────────────────────────────────────────

type AppScreen = "welcome" | "wizard" | "result";
type WizardStep = 1 | 2 | 3 | 4;
type ResultTab = "meals" | "cart" | "profile";

interface TgUser {
  id: number;
  firstName: string;
  username?: string;
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function Page() {
  // Auth
  const [tgUser, setTgUser] = useState<TgUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation
  const [screen, setScreen] = useState<AppScreen>("welcome");
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Period
  const [period, setPeriod] = useState<PlanPeriod>("week");

  // Step 2: Budget
  const [budget, setBudget] = useState<number>(BUDGET_CONFIG.week.default);

  // Step 3: Family
  const [family, setFamily] = useState<FamilyMember[]>([
    {
      id: crypto.randomUUID(),
      name: "Я",
      ageGroup: "adult",
      allergies: [],
    },
  ]);

  // Step 4: Preferences
  const [dietPref, setDietPref] = useState<DietPref>("classic");
  const [globalAllergies, setGlobalAllergies] = useState<Allergy[]>([]);

  // Result
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<PlanResponse | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("meals");
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderLinks, setOrderLinks] = useState<Record<string, string>>({});

  // ── Auth on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = initTelegramWebApp();

    async function doAuth() {
      try {
        // Try existing session first
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const data = await meRes.json();
          if (data.user) {
            setTgUser({
              id: data.user.telegramId ?? data.user.id,
              firstName:
                data.user.firstName ??
                data.user.first_name ??
                "Пользователь",
              username: data.user.username,
            });
            return;
          }
        }

        // Fall back to Telegram initData
        const initData = tg?.initData;
        if (initData) {
          const authRes = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }),
          });
          if (authRes.ok) {
            const data = await authRes.json();
            if (data.ok && data.user) {
              setTgUser({
                id: data.user.telegramId ?? data.user.id,
                firstName:
                  data.user.firstName ??
                  data.user.first_name ??
                  "Пользователь",
                username: data.user.username,
              });
            }
          }
        } else {
          // Use Telegram WebApp unsafe data as display fallback
          const unsafeUser = tg?.initDataUnsafe?.user;
          if (unsafeUser) {
            setTgUser({
              id: unsafeUser.id ?? 0,
              firstName: unsafeUser.first_name ?? "Пользователь",
            });
          }
        }
      } catch {
        // Auth errors are non-fatal; app still works anonymously
      } finally {
        setAuthLoading(false);
      }
    }

    doAuth();
  }, []);

  // ── Period change resets budget to default ────────────────────────────────
  const handlePeriodChange = useCallback((p: PlanPeriod) => {
    setPeriod(p);
    setBudget(BUDGET_CONFIG[p].default);
  }, []);

  // ── Family helpers ────────────────────────────────────────────────────────
  const addMember = () => {
    setFamily((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        ageGroup: "adult",
        allergies: [],
      },
    ]);
  };

  const removeMember = (id: string) => {
    setFamily((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, patch: Partial<FamilyMember>) => {
    setFamily((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  };

  const toggleMemberAllergy = (memberId: string, allergy: Allergy) => {
    setFamily((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const has = m.allergies.includes(allergy);
        return {
          ...m,
          allergies: has
            ? m.allergies.filter((a) => a !== allergy)
            : [...m.allergies, allergy],
        };
      })
    );
  };

  const toggleGlobalAllergy = (allergy: Allergy) => {
    setGlobalAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy]
    );
  };

  // ── Plan generation ───────────────────────────────────────────────────────
  const generatePlan = async () => {
    setPlanLoading(true);
    setPlanError(null);

    // Merge global allergies into each family member
    const familyWithAllergies = family.map((m) => ({
      ...m,
      allergies: Array.from(new Set([...m.allergies, ...globalAllergies])),
    }));

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          budget,
          family: familyWithAllergies,
          dietPref,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || `Ошибка ${res.status}`
        );
      }

      const data: PlanResponse = await res.json();
      setPlanResult(data);
      setScreen("result");
      setResultTab("meals");
    } catch (e) {
      setPlanError(
        e instanceof Error ? e.message : "Неизвестная ошибка"
      );
    } finally {
      setPlanLoading(false);
    }
  };

  // ── Order ─────────────────────────────────────────────────────────────────
  const placeOrder = async () => {
    if (!planResult) return;
    setOrderLoading(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart: planResult.cart }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrderLinks(
          (data as { orderLinks?: Record<string, string> }).orderLinks ?? {}
        );
      }
    } catch {
      // Non-fatal
    } finally {
      setOrderLoading(false);
    }
  };

  // ── Wizard navigation ─────────────────────────────────────────────────────
  const canProceed = (): boolean => {
    if (step === 3) return family.length > 0;
    return true;
  };

  const nextStep = () => {
    if (step < 4) {
      setStep((s) => (s + 1) as WizardStep);
    } else {
      generatePlan();
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep);
    } else {
      setScreen("welcome");
    }
  };

  const toggleMealSteps = (mealId: string) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div
        className="app-shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  // ── Render: Welcome ───────────────────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <div className="app-shell">
        <main className="app-main">
          <section className="hero animate-fade-up">
            <div className="hero-topline">🍽 Семейное меню</div>
            <h1 className="hero-greeting">
              {tgUser ? `Привет, ${tgUser.firstName}!` : "Привет!"}
            </h1>
            <p className="hero-subtitle">
              Составим идеальный рацион для вашей семьи — с учётом бюджета, вкусов и аллергий
            </p>

            <div className="stats-row animate-fade-up delay-1">
              <div className="stat-card">
                <span className="stat-icon">🥘</span>
                <span className="stat-value">500+</span>
                <span className="stat-label">рецептов</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🛒</span>
                <span className="stat-value">3</span>
                <span className="stat-label">магазина</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">💰</span>
                <span className="stat-value">-30%</span>
                <span className="stat-label">экономия</span>
              </div>
            </div>

            <button
              className="primary-btn animate-fade-up delay-2"
              onClick={() => setScreen("wizard")}
              style={{ marginTop: 32 }}
            >
              Начнём! 🚀
            </button>
          </section>
        </main>
      </div>
    );
  }

  // ── Render: Result ────────────────────────────────────────────────────────
  if (screen === "result" && planResult) {
    const spent = planResult.totalEstimated;
    const total = planResult.budget;
    const pct = Math.min((spent / total) * 100, 100);
    const isOver = spent > total;

    return (
      <div className="app-shell">
        <main className="app-main">

          {/* ── Tab: Рацион ── */}
          {resultTab === "meals" && (
            <div className="animate-fade-up">
              <section className="content-section">
                <div className="budget-bar-wrap">
                  <div className="budget-bar-header">
                    <span className="budget-bar-spent">
                      {formatRub(spent)} ₽
                    </span>
                    <span className="budget-bar-total">
                      из {formatRub(total)} ₽
                    </span>
                  </div>
                  <div className="budget-bar-track">
                    <div
                      className={
                        isOver
                          ? "budget-bar-fill budget-bar-fill-over"
                          : "budget-bar-fill"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </section>

              {planResult.notes && planResult.notes.length > 0 && (
                <section className="content-section">
                  <div className="notes-box">
                    {planResult.notes.map((note, i) => (
                      <p key={i} className="subtle">
                        💡 {note}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <section className="content-section">
                <h2 className="section-title">
                  <span className="section-title-icon">🍽</span> Рацион
                </h2>
                <div className="meals-list">
                  {planResult.meals.map(({ meal, times, estimatedTotal }) => (
                    <div key={meal.id} className="meal-card card">
                      <div className="meal-card-header">
                        <span className="meal-emoji">
                          {getMealEmoji(meal.id)}
                        </span>
                        <div className="meal-info">
                          <div className="meal-title">{meal.title}</div>
                          <div className="meal-desc">{meal.description}</div>
                          <div className="meal-meta">
                            <span className="meal-meta-item">
                              ⏱ {meal.minutes} мин
                            </span>
                            <span className="meal-meta-item">
                              🔥 {meal.kcalPerServing} ккал
                            </span>
                            {times > 1 && (
                              <span className="meal-meta-item">✕{times}</span>
                            )}
                          </div>
                          {meal.tags && meal.tags.length > 0 && (
                            <div className="chips" style={{ marginTop: 6 }}>
                              {meal.tags.map((tag) => (
                                <span key={tag} className="chip">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="meal-cost-badge">
                          {formatRub(estimatedTotal)} ₽
                        </span>
                      </div>

                      {meal.steps && meal.steps.length > 0 && (
                        <>
                          <button
                            className="meal-steps-toggle"
                            onClick={() => toggleMealSteps(meal.id)}
                          >
                            {expandedMeals.has(meal.id)
                              ? "Скрыть рецепт ▲"
                              : "Показать рецепт ▼"}
                          </button>
                          {expandedMeals.has(meal.id) && (
                            <ol className="meal-steps">
                              {meal.steps.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ol>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ── Tab: Корзина ── */}
          {resultTab === "cart" && (
            <div className="animate-fade-up">
              <section className="content-section">
                <h2 className="section-title">
                  <span className="section-title-icon">🛒</span> Корзина
                </h2>

                {planResult.stores.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🛒</div>
                    <div className="empty-text">Корзина пуста</div>
                    <div className="empty-hint">
                      Сгенерируйте рацион, чтобы увидеть товары
                    </div>
                  </div>
                ) : (
                  <div className="store-list">
                    {planResult.stores.map(({ store, subtotal, items }) => (
                      <div key={store.id} className="store-card card">
                        <div className="store-card-header">
                          <span style={{ fontSize: 24 }}>{store.logo}</span>
                          <div>
                            <div className="store-name">{store.name}</div>
                            <div className="store-badge">
                              {formatRub(subtotal)} ₽
                            </div>
                          </div>
                        </div>
                        <div className="store-items">
                          {items.map((item, i) => (
                            <div key={i} className="store-item">
                              <span>
                                {item.productName} — {item.quantity}{" "}
                                {item.unit}
                              </span>
                              <span className="store-item-price">
                                {formatRub(item.price)} ₽
                              </span>
                            </div>
                          ))}
                        </div>
                        {orderLinks[store.id] ? (
                          <a
                            href={orderLinks[store.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="store-link"
                          >
                            Перейти к заказу →
                          </a>
                        ) : (
                          <a
                            href={store.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="store-link"
                          >
                            Открыть магазин →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {Object.keys(orderLinks).length === 0 &&
                planResult.stores.length > 0 && (
                  <section className="content-section">
                    <div className="order-box">
                      <button
                        className={
                          orderLoading
                            ? "primary-btn primary-btn-loading"
                            : "primary-btn"
                        }
                        onClick={placeOrder}
                        disabled={orderLoading}
                      >
                        {orderLoading ? (
                          <>
                            <span className="spinner" /> Оформляем...
                          </>
                        ) : (
                          "Заказать всё сразу 🛒"
                        )}
                      </button>
                    </div>
                  </section>
                )}
            </div>
          )}

          {/* ── Tab: Профиль ── */}
          {resultTab === "profile" && (
            <div className="animate-fade-up">
              {tgUser && (
                <section className="content-section">
                  <div className="profile-card card">
                    <div className="profile-avatar">
                      {tgUser.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info">
                      <div className="profile-name">{tgUser.firstName}</div>
                      {tgUser.username && (
                        <div className="profile-username">
                          @{tgUser.username}
                        </div>
                      )}
                      <div className="profile-id">ID: {tgUser.id}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Subscription card */}
              <section className="content-section">
                <h2 className="section-title">
                  <span className="section-title-icon">⭐</span> Подписка
                </h2>
                <div
                  className="card"
                  style={{
                    padding: 20,
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    borderRadius: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Plan & Eat Pro
                  </div>
                  <div
                    style={{
                      opacity: 0.85,
                      marginBottom: 16,
                      fontSize: 14,
                    }}
                  >
                    Неограниченные рационы, приоритетная поддержка,
                    эксклюзивные рецепты
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 4,
                      marginBottom: 16,
                    }}
                  >
                    <span style={{ fontSize: 32, fontWeight: 800 }}>
                      299 ₽
                    </span>
                    <span style={{ opacity: 0.75, fontSize: 14 }}>/мес</span>
                  </div>
                  <button
                    className="primary-btn"
                    style={{
                      background: "#fff",
                      color: "#764ba2",
                      width: "100%",
                    }}
                  >
                    Попробовать бесплатно 7 дней
                  </button>
                </div>
              </section>

              {/* Settings menu */}
              <section className="content-section">
                <h2 className="section-title">
                  <span className="section-title-icon">⚙️</span> Настройки
                </h2>
                <div className="card">
                  <div className="menu-list">
                    <div
                      className="menu-item"
                      onClick={() => {
                        setScreen("wizard");
                        setStep(1);
                        setPlanResult(null);
                        setPlanError(null);
                      }}
                    >
                      <span className="menu-icon">🔄</span>
                      <div className="menu-text">
                        <div className="menu-title">Новый рацион</div>
                        <div className="menu-desc">
                          Создать план питания заново
                        </div>
                      </div>
                      <span className="menu-arrow">›</span>
                    </div>
                    <div className="menu-item">
                      <span className="menu-icon">📋</span>
                      <div className="menu-text">
                        <div className="menu-title">История рационов</div>
                        <div className="menu-desc">
                          Ваши прошлые планы питания
                        </div>
                      </div>
                      <span className="menu-arrow">›</span>
                    </div>
                    <div className="menu-item">
                      <span className="menu-icon">🔔</span>
                      <div className="menu-text">
                        <div className="menu-title">Уведомления</div>
                        <div className="menu-desc">
                          Напоминания о приёмах пищи
                        </div>
                      </div>
                      <span className="menu-arrow">›</span>
                    </div>
                    <div className="menu-item">
                      <span className="menu-icon">💬</span>
                      <div className="menu-text">
                        <div className="menu-title">Поддержка</div>
                        <div className="menu-desc">
                          Написать в чат поддержки
                        </div>
                      </div>
                      <span className="menu-arrow">›</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Current plan summary */}
              <section className="content-section">
                <h2 className="section-title">
                  <span className="section-title-icon">📊</span> Текущий план
                </h2>
                <div className="card" style={{ padding: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span className="subtle">Период</span>
                      <span>
                        {PERIOD_OPTIONS.find(
                          (p) => p.value === planResult.period
                        )?.label ?? planResult.period}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span className="subtle">Бюджет</span>
                      <span>{formatRub(planResult.budget)} ₽</span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span className="subtle">Расчётная стоимость</span>
                      <span>{formatRub(planResult.totalEstimated)} ₽</span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span className="subtle">Членов семьи</span>
                      <span>{planResult.familySize}</span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span className="subtle">Блюд</span>
                      <span>{planResult.meals.length}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>

        {/* Bottom tab bar */}
        <nav className="tabbar">
          <button
            className={resultTab === "meals" ? "active" : ""}
            onClick={() => setResultTab("meals")}
          >
            🍽 Рацион
          </button>
          <button
            className={resultTab === "cart" ? "active" : ""}
            onClick={() => setResultTab("cart")}
          >
            🛒 Корзина
          </button>
          <button
            className={resultTab === "profile" ? "active" : ""}
            onClick={() => setResultTab("profile")}
          >
            👤 Профиль
          </button>
        </nav>
      </div>
    );
  }

  // ── Render: Wizard ────────────────────────────────────────────────────────
  const cfg = BUDGET_CONFIG[period];

  return (
    <div className="app-shell">
      <main className="app-main">

        {/* Step indicator header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 0 8px",
            marginBottom: 8,
          }}
        >
          <button
            onClick={prevStep}
            aria-label="Назад"
            style={{
              background: "none",
              border: "none",
              fontSize: 26,
              cursor: "pointer",
              padding: "0 4px",
              color: "var(--text-secondary, #6b7a99)",
              lineHeight: 1,
            }}
          >
            ‹
          </button>
          <div
            style={{
              display: "flex",
              gap: 6,
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {([1, 2, 3, 4] as WizardStep[]).map((s) => (
              <div
                key={s}
                style={{
                  width: s === step ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background:
                    s === step
                      ? "var(--accent, #6366f1)"
                      : s < step
                      ? "var(--accent-muted, rgba(99,102,241,0.45))"
                      : "var(--divider, rgba(255,255,255,0.08))",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
          <div
            style={{
              width: 32,
              textAlign: "right",
              fontSize: 13,
              color: "var(--text-secondary, #6b7a99)",
            }}
          >
            {step}/4
          </div>
        </div>

        {/* ── Step 1: Period ── */}
        {step === 1 && (
          <section className="content-section animate-fade-up">
            <h2 className="section-title">
              <span className="section-title-icon">📆</span> На какой период?
            </h2>
            <p className="subtle" style={{ marginBottom: 20 }}>
              Выберите период, для которого хотите составить рацион
            </p>
            <div className="period-pills">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`period-pill${
                    period === opt.value ? " period-pill-active" : ""
                  }`}
                  onClick={() => handlePeriodChange(opt.value)}
                >
                  <span className="period-pill-icon">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Step 2: Budget ── */}
        {step === 2 && (
          <section className="content-section animate-fade-up">
            <h2 className="section-title">
              <span className="section-title-icon">💰</span> Бюджет
            </h2>
            <p className="subtle" style={{ marginBottom: 20 }}>
              Укажите сумму на{" "}
              {PERIOD_OPTIONS.find(
                (p) => p.value === period
              )?.label.toLowerCase()}
            </p>

            <div className="budget-display">
              <span className="budget-amount">{formatRub(budget)}</span>
              <span className="budget-currency">₽</span>
            </div>

            <input
              type="range"
              className="budget-slider"
              min={cfg.min}
              max={cfg.max}
              step={cfg.step}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />

            <div className="budget-range-labels">
              <span>{formatRub(cfg.min)} ₽</span>
              <span>{formatRub(cfg.max)} ₽</span>
            </div>

            <div className="stats-row" style={{ marginTop: 24 }}>
              {(period === "week" || period === "month") ? (
                <>
                  <div className="stat-card">
                    <span className="stat-icon">📅</span>
                    <span className="stat-value">
                      {formatRub(
                        Math.round(budget / (period === "week" ? 7 : 30))
                      )}
                    </span>
                    <span className="stat-label">₽/день</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">🍽</span>
                    <span className="stat-value">
                      {formatRub(
                        Math.round(
                          budget /
                            (period === "week" ? 21 : 90) /
                            (family.length || 1)
                        )
                      )}
                    </span>
                    <span className="stat-label">₽/приём на чел.</span>
                  </div>
                </>
              ) : (
                <div className="stat-card">
                  <span className="stat-icon">🍽</span>
                  <span className="stat-value">
                    {formatRub(
                      Math.round(budget / (family.length || 1))
                    )}
                  </span>
                  <span className="stat-label">₽ на человека</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Step 3: Family ── */}
        {step === 3 && (
          <section className="content-section animate-fade-up">
            <div className="family-section-head">
              <h2 className="section-title">
                <span className="section-title-icon">👨‍👩‍👧‍👦</span> Состав семьи
              </h2>
              <button className="add-member-btn" onClick={addMember}>
                + Добавить
              </button>
            </div>
            <p className="subtle" style={{ marginBottom: 16 }}>
              Укажите всех, для кого составляем рацион
            </p>

            <div className="family-list">
              {family.map((member, idx) => (
                <div key={member.id} className="member-card card">
                  <div className="member-header">
                    <span className="member-emoji">
                      {MEMBER_EMOJIS[idx % MEMBER_EMOJIS.length]}
                    </span>
                    <input
                      className="member-name-input"
                      type="text"
                      placeholder="Имя (необязательно)"
                      value={member.name}
                      onChange={(e) =>
                        updateMember(member.id, { name: e.target.value })
                      }
                    />
                    {family.length > 1 && (
                      <button
                        className="remove-member-btn"
                        onClick={() => removeMember(member.id)}
                        aria-label="Удалить участника"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="member-fields">
                    <div className="member-age-row">
                      {AGE_GROUP_OPTIONS.map((ag) => (
                        <button
                          key={ag.value}
                          className={`age-pill${
                            member.ageGroup === ag.value
                              ? " age-pill-active"
                              : ""
                          }`}
                          onClick={() =>
                            updateMember(member.id, { ageGroup: ag.value })
                          }
                        >
                          {ag.icon} {ag.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary, #6b7a99)",
                          marginBottom: 6,
                        }}
                      >
                        Аллергии:
                      </div>
                      <div className="chips">
                        {ALLERGY_OPTIONS.map((a) => (
                          <button
                            key={a.value}
                            className={`chip${
                              member.allergies.includes(a.value)
                                ? " chip-active"
                                : ""
                            }`}
                            onClick={() =>
                              toggleMemberAllergy(member.id, a.value)
                            }
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Step 4: Preferences ── */}
        {step === 4 && (
          <section className="content-section animate-fade-up">
            <h2 className="section-title">
              <span className="section-title-icon">🥗</span> Предпочтения
            </h2>
            <p className="subtle" style={{ marginBottom: 16 }}>
              Выберите тип питания для всей семьи
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {DIET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDietPref(opt.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    textAlign: "left",
                    border:
                      dietPref === opt.value
                        ? "2px solid var(--accent, #6366f1)"
                        : "2px solid transparent",
                    cursor: "pointer",
                    width: "100%",
                    background:
                      dietPref === opt.value
                        ? "var(--card-active-bg, rgba(99,102,241,0.18))"
                        : "var(--card-bg, rgba(17,24,39,0.65))",
                    borderRadius: 14,
                    transition: "all 0.2s",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.3)",
                  }}
                >
                  <span style={{ fontSize: 28 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {opt.label}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary, #6b7a99)",
                        marginTop: 2,
                      }}
                    >
                      {opt.desc}
                    </div>
                  </div>
                  {dietPref === opt.value && (
                    <span
                      style={{
                        color: "var(--accent, #6366f1)",
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>

            <h3
              style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}
            >
              Общие аллергии для всей семьи
            </h3>
            <div className="chips">
              {ALLERGY_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  className={`chip${
                    globalAllergies.includes(a.value) ? " chip-active" : ""
                  }`}
                  onClick={() => toggleGlobalAllergy(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {planError && (
              <div className="error-text" style={{ marginTop: 16 }}>
                ⚠️ {planError}
              </div>
            )}
          </section>
        )}

        {/* Next / Generate button */}
        <div style={{ padding: "8px 0 24px" }}>
          <button
            className={
              planLoading
                ? "primary-btn primary-btn-loading"
                : "primary-btn"
            }
            onClick={nextStep}
            disabled={planLoading || !canProceed()}
          >
            {planLoading ? (
              <>
                <span className="spinner" /> Составляем рацион...
              </>
            ) : step < 4 ? (
              "Далее →"
            ) : (
              "Составить рацион 🚀"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
