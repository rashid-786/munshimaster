import { getStatesForCountry } from '../data/states';
import SearchableSelect from './SearchableSelect';

function getDefaultCountry() {
  try {
    const gc = JSON.parse(localStorage.getItem('global_config'));
    if (gc?.defaultCountry) return gc.defaultCountry;
  } catch {}
  return 'IN';
}

export default function StateSelect({ value, onChange, countryCode }) {
  const code = countryCode || getDefaultCountry();
  const states = getStatesForCountry(code);

  return (
    <SearchableSelect
      options={states.map(s => ({ value: s, label: s }))}
      value={value || ''}
      onChange={onChange}
      placeholder="Search or select state..."
    />
  );
}
