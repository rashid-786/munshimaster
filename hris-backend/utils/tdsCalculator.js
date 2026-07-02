const TDS_SECTIONS = {
  '194C': { label: 'Contract Payments', defaultRate: 1.0, threshold: 30000, aggregateThreshold: 100000 },
  '194J': { label: 'Professional / Technical Fees', defaultRate: 10.0, threshold: 30000 },
  '194H': { label: 'Commission / Brokerage', defaultRate: 5.0, threshold: 15000 },
  '194I': { label: 'Rent', defaultRate: 10.0, threshold: 240000 },
  '194IA': { label: 'Rent - Plant & Machinery', defaultRate: 2.0, threshold: 240000 },
  '194D': { label: 'Insurance Commission', defaultRate: 5.0, threshold: 15000 },
  '194M': { label: 'Commission to Individual/HUF', defaultRate: 5.0, threshold: 5000000 },
  '194O': { label: 'E-commerce Participant', defaultRate: 1.0, threshold: 0 },
  'Other': { label: 'Other TDS', defaultRate: 10.0, threshold: 0 },
};

function computeTds(amount, section, rate) {
  const sectionInfo = TDS_SECTIONS[section] || TDS_SECTIONS['Other'];
  const tdsRate = parseFloat(rate) || sectionInfo.defaultRate;

  if (amount <= (sectionInfo.threshold || 0)) {
    return { tdsAmount: 0, tdsRate, applicable: false, reason: 'Below threshold' };
  }

  const tdsAmount = Math.round(amount * tdsRate / 100 * 100) / 100;
  return { tdsAmount, tdsRate, applicable: true, reason: null };
}

function getTdsPeriod(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  // TDS period is financial year quarter: Q1(Apr-Jun), Q2(Jul-Sep), Q3(Oct-Dec), Q4(Jan-Mar)
  const q = month <= 3 ? 4 : Math.ceil((month - 3) / 3);
  return `Q${q}${String(year).slice(-2)}`;
}

module.exports = { computeTds, getTdsPeriod, TDS_SECTIONS };
