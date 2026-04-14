export function alertLevel(days) {
  if (days === null) return "unknown";
  if (days < 0) return "purple";
  if (days <= 15) return "red";
  if (days <= 30) return "orange";
  return "yellow";
}

export function alertIcon(alert) {
  if (alert === "red") return "🔴";
  if (alert === "orange") return "🟠";
  if (alert === "yellow") return "🟡";
  if (alert === "purple") return "🟣";
  return "⚪";
}
