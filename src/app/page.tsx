"use client";

import { useEffect, useMemo, useState } from "react";
import { initTelegramWebApp } from "@/lib/telegram";
import type { Allergy, FamilyMember, PlanPeriod, PlanResponse } from "@/types";

const ALLERGIES: Array<{ value: Allergy; label: string }> = [
  { value: "nuts", label: "Nuts" },
  { value: "lactose", label: "Lactose" },
  { value: "gluten", label: "Gluten" },
  { value: "seafood", label: "Seafood" },
  { value: "eggs", label: "Eggs" },
  { value: "soy", label: "Soy" },
];

const PERIODS: Array<{ value: PlanPeriod; label: string }> = [
  { value: "dinner", label: "Dinner plan" },
  { value: "day", label: "Full day" },
  { value: "month", label: "Month" },
];

function createMember(index: number): FamilyMember {
  return {
    id: crypto.randomUUID(),
    name: `Member ${index + 1}`,
    ageGroup: index < 2 ? "adult" : "child",
    allergies: [],
  };
}

export default function Home() {
  const [period, setPeriod] = useState<PlanPeriod>("day");
  const [budget, setBudget] = useState<number>(4000);
  const [family, setFamily] = useState<FamilyMember[]>([createMember(0), createMember(1)]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramName, setTelegramName] = useState<string>("");
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    links: Array<{ storeName: string; checkoutUrl: string }>;
  } | null>(null);

  useEffect(() => {
    const tg = initTelegramWebApp();
    const name = tg?.initDataUnsafe?.user?.first_name;
    if (name) {
      setTelegramName(name);
    }
  }, []);

  const monthlyHint = useMemo(() => {
    if (period !== "month") {
      return null;
    }
    return `For monthly mode keep budget from ${Math.round(family.length * 9000)} UAH and above.`;
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
        throw new Error(data.error ?? "Failed to generate plan");
      }

      setPlan(data);
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async () => {
    if (!plan?.cart?.length) {
      return;
    }

    const response = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart: plan.cart }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Order creation failed");
      return;
    }

    setOrderResult({
      orderId: data.orderId,
      links: data.orderLinks,
    });
  };

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-a" />
      <div className="bg-orb bg-orb-b" />
      <main className="container">
        <section className="hero card">
          <p className="eyebrow">Telegram Mini App</p>
          <h1>Family Budget Nutrition Planner</h1>
          <p>
            Build a food plan for dinner, day, or month, considering allergies for each family
            member and estimated prices by retail stores.
          </p>
          {telegramName ? <p className="hello">Hi, {telegramName}</p> : null}
        </section>

        <section className="card form-card">
          <h2>Plan Setup</h2>
          <div className="grid">
            <label>
              Budget (UAH)
              <input
                type="number"
                min={100}
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
              />
            </label>
            <label>
              Planning period
              <select value={period} onChange={(event) => setPeriod(event.target.value as PlanPeriod)}>
                {PERIODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {monthlyHint ? <p className="note">{monthlyHint}</p> : null}

          <div className="family-header">
            <h3>Family members</h3>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setFamily((current) => [...current, createMember(current.length)])}
            >
              + Add member
            </button>
          </div>

          <div className="members">
            {family.map((member, index) => (
              <article className="member" key={member.id}>
                <div className="member-row">
                  <input
                    value={member.name}
                    onChange={(event) => updateMember(member.id, { name: event.target.value })}
                    aria-label="Member name"
                  />
                  <select
                    value={member.ageGroup}
                    onChange={(event) =>
                      updateMember(member.id, {
                        ageGroup: event.target.value as FamilyMember["ageGroup"],
                      })
                    }
                  >
                    <option value="adult">Adult</option>
                    <option value="teen">Teen</option>
                    <option value="child">Child</option>
                  </select>
                  {family.length > 1 ? (
                    <button
                      className="ghost-btn danger"
                      type="button"
                      onClick={() =>
                        setFamily((current) => current.filter((item) => item.id !== member.id))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="allergies">
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
                <p className="member-index">Member #{index + 1}</p>
              </article>
            ))}
          </div>

          <button className="primary-btn" type="button" onClick={buildPlan} disabled={loading}>
            {loading ? "Building plan..." : "Generate nutrition plan"}
          </button>

          {error ? <p className="error">{error}</p> : null}
        </section>

        {plan ? (
          <section className="card result-card">
            <div className="result-top">
              <div>
                <h2>Recommended Plan</h2>
                <p>
                  Estimated total: <strong>{plan.totalEstimated.toLocaleString()} UAH</strong> / Budget:
                  {" "}
                  {plan.budget.toLocaleString()} UAH
                </p>
              </div>
              <button type="button" className="primary-btn" onClick={createOrder}>
                Create order draft
              </button>
            </div>

            <div className="meals">
              {plan.meals.map((entry) => (
                <article key={entry.meal.id} className="meal-card">
                  <h3>{entry.meal.title}</h3>
                  <p>{entry.meal.description}</p>
                  <p>
                    Repeats: <strong>{entry.times}</strong> | Prep: <strong>{entry.meal.minutes} min</strong>
                  </p>
                  <p>
                    Cost estimate: <strong>{Math.round(entry.estimatedTotal)} UAH</strong>
                  </p>
                  <ol>
                    {entry.meal.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>

            <h3>Where to buy</h3>
            <div className="stores">
              {plan.stores.map((store) => (
                <article key={store.store.id} className="store-card">
                  <div className="store-title">
                    <h4>{store.store.name}</h4>
                    <span>{Math.round(store.subtotal)} UAH</span>
                  </div>
                  <ul>
                    {store.items.map((item) => (
                      <li key={`${store.store.id}-${item.productName}`}>
                        {item.productName} {item.quantity} {item.unit}
                      </li>
                    ))}
                  </ul>
                  <a href={store.store.checkoutUrl} target="_blank" rel="noreferrer">
                    Open {store.store.name}
                  </a>
                </article>
              ))}
            </div>

            {plan.notes.length ? (
              <div className="notes">
                {plan.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}

            {orderResult ? (
              <div className="order-result">
                <h3>Order Draft #{orderResult.orderId}</h3>
                {orderResult.links.map((link) => (
                  <a key={link.storeName} href={link.checkoutUrl} target="_blank" rel="noreferrer">
                    Checkout in {link.storeName}
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
