/**
 * ──────────────────────────────────────────────────────────
 * Subscription Menu Builder
 *
 * Dynamically generates sidebar menus, mobile navigation,
 * and route visibility based on the tenant's subscription
 * plan. No hardcoded plan conditions — all rules are
 * declared as data.
 * ──────────────────────────────────────────────────────────
 */

import { MENU_SECTIONS, PLANS, getRank, hasFeature, FEATURE_LABELS, resolvePlan } from './subscriptionPlans';

/**
 * Explicit plan-visibility overrides.
 *
 * Each entry declares what plan(s) a menu section is
 * visible (or hidden) on, overriding the default
 * feature-based behaviour.
 *
 * Structure:
 *   sectionId: { visibleOn?: PlanType[], hiddenOn?: PlanType[] }
 *
 * `visibleOn`  — only these plans see the section.
 * `hiddenOn`   — these plans never see the section (takes precedence).
 */
const VISIBILITY_OVERRIDES = {
  my_bahi_book: {
    visibleOn: ['FREE', 'MANAGE'],
  },
  my_staff: {
    visibleOn: ['MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
  },
};

/**
 * Plan-based label overrides.
 * Keyed by feature key (or section id for sections without feature).
 * If a plan is not listed, the original MENU_SECTIONS label is kept.
 */
const LABEL_OVERRIDES = {
  entities: {
    FREE: 'My Stores',
    MANAGE: 'My Stores',
  },
};

/**
 * Icons map keyed by the icon name declared in MENU_SECTIONS.
 */
const ICONS = {
  entity: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  ),
  ledger: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
  ),
  business: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  ),
  staff: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  payments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
  ),
  upgrade: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
  ),
  audit: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  ),
  inventory: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
  ),
};

// ─── Helpers ────────────────────────────────────────

/**
 * Check whether a section definition is visible for the given plan.
 * Applies VISIBILITY_OVERRIDES first, then falls back to feature-based check.
 */
function isSectionVisible(section, plan) {
  const sectionId = section.id || section.label?.toLowerCase().replace(/\s+/g, '_');
  const override = VISIBILITY_OVERRIDES[sectionId];

  if (override) {
    if (override.visibleOn) {
      return override.visibleOn.includes(plan);
    }
    if (override.hiddenOn) {
      return !override.hiddenOn.includes(plan);
    }
  }

  if (section.feature && !hasFeature(plan, section.feature)) {
    return false;
  }

  return getRank(plan) >= getRank(section.requiredPlan || 'FREE');
}

/**
 * Check whether a child item is visible for the given plan.
 *
 * Visibility is determined by:
 *   1. Feature flag (if specified) — the plan must have the feature enabled.
 *   2. requiredPlan (if specified AND no feature flag) — rank must meet minimum.
 *
 * Feature takes precedence: if a plan has the feature, the item is visible
 * regardless of requiredPlan (which is a secondary/legacy gate).
 */
function isItemVisible(item, plan) {
  if (item.feature) {
    return hasFeature(plan, item.feature);
  }
  return getRank(plan) >= getRank(item.requiredPlan || 'FREE');
}

// ─── Public API ─────────────────────────────────────

/**
 * Build the full navigation menu filtered for a given plan.
 *
 * Returns an array of section objects with the same shape as
 * MENU_SECTIONS, but only containing sections and items the
 * plan has access to.
 *
 * @param {string} plan — e.g. 'FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'
 * @returns {Array<{label: string, icon: JSX.Element, route: string, type: string, items?: Array}>}
 */
export function buildMenu(plan) {
  const resolvedPlan = PLANS[plan] ? plan : 'FREE';

  return MENU_SECTIONS
    .filter((section) => isSectionVisible(section, resolvedPlan))
    .map((section) => {
      const sectionId = section.id || section.label?.toLowerCase().replace(/\s+/g, '_');

      if (section.type === 'group' && section.items) {
        return {
          ...section,
          id: sectionId,
          icon: ICONS[section.icon] || null,
          items: section.items.filter((item) => isItemVisible(item, resolvedPlan)),
        };
      }

      return {
        ...section,
        id: sectionId,
        icon: ICONS[section.icon] || null,
      };
    })
    .filter((section) => {
      if (section.type === 'group' && section.items && section.items.length === 0) {
        return false;
      }
      return true;
    });
}

/**
 * Check whether a specific route path is accessible under the given plan.
 *
 * @param {string} path — e.g. '/admin/ledger', '/admin/employees'
 * @param {string} plan
 * @returns {boolean}
 */
export function isRouteAccessible(path, plan) {
  const resolvedPlan = PLANS[plan] ? plan : 'FREE';

  for (const section of MENU_SECTIONS) {
    if (section.route === path) {
      return isSectionVisible(section, resolvedPlan);
    }
    if (section.items) {
      for (const item of section.items) {
        if (item.route === path) {
          if (!isItemVisible(item, resolvedPlan)) return false;
          return isSectionVisible(section, resolvedPlan);
        }
      }
    }
  }

  return true;
}

/**
 * Return the list of all accessible route paths for a given plan.
 *
 * @param {string} plan
 * @returns {string[]}
 */
export function getAccessibleRoutes(plan) {
  const resolvedPlan = PLANS[plan] ? plan : 'FREE';
  const routes = [];

  for (const section of MENU_SECTIONS) {
    if (!isSectionVisible(section, resolvedPlan)) continue;
    if (section.type !== 'group') {
      routes.push(section.route);
    }
    if (section.items) {
      for (const item of section.items) {
        if (isItemVisible(item, resolvedPlan)) {
          routes.push(item.route);
        }
      }
    }
  }

  return routes;
}

/**
 * Find the first visible dashboard route for a plan.
 * Used as a fallback redirect when the user's current route
 * becomes inaccessible.
 *
 * @param {string} plan
 * @returns {string}
 */
export function getFirstDashboardRoute(plan) {
  const menu = buildMenu(plan);
  if (menu.length === 0) return '/admin/ledger';

  const dashboard = menu.find(m => m.type === 'group') || menu[0];
  return dashboard.route;
}

/**
 * Look up the feature information for a given route path.
 *
 * Returns `null` if the route is not found in MENU_SECTIONS.
 *
 * @param {string} path — e.g. '/admin/employees', '/admin/invoices'
 * @returns {{ featureName: string|null, requiredPlan: string, featureKey: string|null } | null}
 */
export function getRouteAccessInfo(path) {
  for (const section of MENU_SECTIONS) {
    if (section.route === path) {
      const featureKey = section.feature || null;
      return {
        featureName: featureKey ? FEATURE_LABELS[featureKey] : section.label,
        requiredPlan: resolvePlan(section.requiredPlan),
        featureKey,
      };
    }
    if (section.items) {
      for (const item of section.items) {
        if (item.route === path) {
          const featureKey = item.feature || section.feature || null;
          return {
            featureName: featureKey ? FEATURE_LABELS[featureKey] : item.label,
            requiredPlan: resolvePlan(item.requiredPlan),
            featureKey,
          };
        }
      }
    }
  }
  return null;
}
