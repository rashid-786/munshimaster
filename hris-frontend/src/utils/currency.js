export function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars) {
  return Math.round(dollars * 100);
}
