/* scripts/memory-config.js
 * Blossom & Blade — Memory Budgets & Rules
 *
 * Purpose:
 * - Central place to decide how "big" the memory and context should be
 *   based on the user's plan, renewals, and extended-memory status.
 * - No API calls here; this is just numbers + simple logic the chat UI reads.
 *
 * Plans:
 * - day_pass: 24-hour memory window, smaller budget
 * - monthly: 31-day memory window, larger budget
 * Perks:
 * - extended memory: enabled only after renewal (month 2+)
 * - “third-month perk”: if renews_count >= 2 (i.e., they’re entering month 3),
 *   give them the “extra” memory bump automatically (you wanted this perk).
 */

const BBMemoryConfig = (() => {
  // Base token targets (approx total per turn, input context only)
  // We keep them conservative; your model reply tokens add on top.
  const BUDGETS = {
    day_pass: {
      summaryTokens: 600,   // rolling persona summary target
      recencyPairs: 4,      // last X user/ai pairs
      turnContextMax: 1200, // summary + recency + tiny knowledge
      windowHours: 24       // memory lifetime
    },
    monthly: {
      summaryTokens: 1400,
      recencyPairs: 6,
      turnContextMax: 2000,
      windowDays: 31
    },
    // Extended (renewal-only add-on) – replaces monthly defaults when active
    monthlyExtended: {
      summaryTokens: 2000,
      recencyPairs: 8,
      turnContextMax: 2600,
      windowDays: 31
    },
    // Third-month perk (auto bump even if they didn’t buy extended)
    monthlyThirdMonthPerk: {
      summaryTokens: 1800,
      recencyPairs: 7,
      turnContextMax: 2300,
      windowDays: 31
    }
  };

  /**
   * entitlement = {
   *   plan: 'day_pass' | 'monthly',
   *   start_at: '2025-10-12T12:00:00Z',
   *   end_at:   '2025-11-12T12:00:00Z',
   *   renews_count: number,       // 0 = first month, 1 = second, 2 = third
   *   has_extended: boolean       // only offered on renewal
   * }
   */
  function getMemoryBudget(entitlement) {
    if (!entitlement || !entitlement.plan) {
      // Safe default: behave like day pass
      return { ...BUDGETS.day_pass, plan: 'day_pass' };
    }

    if (entitlement.plan === 'day_pass') {
      return { ...BUDGETS.day_pass, plan: 'day_pass' };
    }

    // Monthly logic
    const isThirdMonthOrBeyond = (entitlement.renews_count || 0) >= 2;

    // Extended only applies on renewal (renews_count >= 1) and if has_extended = true
    const eligibleForExtended = (entitlement.renews_count || 0) >= 1 && !!entitlement.has_extended;

    if (eligibleForExtended) {
      return { ...BUDGETS.monthlyExtended, plan: 'monthly', perk: 'extended' };
    }

    if (isThirdMonthOrBeyond) {
      // Your requested perk: auto extra memory on month 3+
      return { ...BUDGETS.monthlyThirdMonthPerk, plan: 'monthly', perk: 'third_month' };
    }

    // Regular monthly (first month, no add-on)
    return { ...BUDGETS.monthly, plan: 'monthly', perk: null };
  }

  /**
   * Helper to enforce trimming of the rolling summary JSON.
   * You’ll call this BEFORE sending the prompt to the model.
   * Implement the actual trimming in your prompt builder; this just hands you a target.
   */
  function getSummaryTokenTarget(entitlement) {
    return getMemoryBudget(entitlement).summaryTokens;
  }

  /**
   * Helper describing how many recent pairs to include (user+ai pairs).
   */
  function getRecencyPairs(entitlement) {
    return getMemoryBudget(entitlement).recencyPairs;
  }

  /**
   * Upper bound for the whole turn input context (system rules + summary + recency + optional knowledge).
   * Your prompt builder should trim to stay under this.
   */
  function getTurnContextMax(entitlement) {
    return getMemoryBudget(entitlement).turnContextMax;
  }

  /**
   * For display/UI: show the memory window that applies.
   */
  function getMemoryWindow(entitlement) {
    const cfg = getMemoryBudget(entitlement);
    if (cfg.windowHours) return { hours: cfg.windowHours, days: 0 };
    return { hours: 0, days: cfg.windowDays || 0 };
  }

  return {
    getMemoryBudget,
    getSummaryTokenTarget,
    getRecencyPairs,
    getTurnContextMax,
    getMemoryWindow
  };
})();

// UMD-ish export
if (typeof window !== 'undefined') window.BBMemoryConfig = BBMemoryConfig;
try { module.exports = BBMemoryConfig; } catch (_) {}
