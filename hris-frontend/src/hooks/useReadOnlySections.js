import { useState, useEffect } from 'react';
import { hrService } from '../services/hr.service';

export function useReadOnlySections() {
  const [readOnlyMap, setReadOnlyMap] = useState({});

  useEffect(() => {
    hrService.getTenantSections().then(res => {
      const map = {};
      for (const [key, val] of Object.entries(res.sections || {})) {
        if (val.readOnly) map[key] = true;
      }
      setReadOnlyMap(map);
    }).catch(() => {});
  }, []);

  const isReadOnly = (sectionKey) => !!readOnlyMap[sectionKey];

  return { isReadOnly, readOnlyMap };
}