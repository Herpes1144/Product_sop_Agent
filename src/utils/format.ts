export function formatBooleanLabel(value: boolean): string {
  return value ? "是" : "否";
}

export function formatSearchableText(parts: Array<string | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
