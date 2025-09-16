// cabinet.js (entry point)
import AccountApp from "./cabinet/app.js";
import { authRefresh, authMe, authDevices, authSubscriptions } from "./api.js";

async function bootstrapAccount() {
  try {
    const refresh = await authRefresh();
    if (!refresh.ok) {
      return { attempted: true, authed: false };
    }

    const [me, dev, subs] = await Promise.all([authMe(), authDevices(), authSubscriptions()]);
    if (!me?.ok || !me.data) {
      return { attempted: true, authed: false };
    }

    const devicesLoaded = !!dev?.ok;
    const plansLoaded = !!(subs?.ok && Array.isArray(subs.data));
    const devices = devicesLoaded ? (dev.data || []) : [];
    const plans = plansLoaded ? subs.data : [];
    const selectedPlanId = plans.length ? String(plans[0].id) : "";

    return {
      attempted: true,
      authed: true,
      profile: me.data,
      devices,
      plans,
      selectedPlanId,
      devicesLoaded,
      plansLoaded
    };
  } catch (err) {
    console.error("cabinet bootstrap failed", err);
    return { attempted: false };
  }
}

(async () => {
  const bootstrap = await bootstrapAccount();
  ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(AccountApp, { bootstrap })
  );
})();
