import { useState, useEffect } from 'react';
import { subscriptionService } from '../services/subscription.service';

export function useFeature(featureKey) {
  const [result, setResult] = useState({ allowed: null, plan: null, limit: null, usage: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    subscriptionService.checkFeature(featureKey)
      .then(res => { if (mounted) setResult(res); })
      .catch(() => { if (mounted) setResult({ allowed: false, plan: 'free', limit: 0, usage: 0 }); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [featureKey]);

  return { ...result, loading };
}

export function useUpgradeTrigger({ featureKey, currentValue, thresholdPct = 0.8, onUpgradeNeeded }) {
  const { allowed, limit, usage, loading } = useFeature(featureKey);
  const showNudge = !loading && !allowed && limit > 0 && currentValue >= limit * thresholdPct;
  return { allowed, loading, showNudge, limit, usage };
}
