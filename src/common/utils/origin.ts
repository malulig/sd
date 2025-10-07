export function getAllowedOrigins(): string[] {
  const raw = process.env.CLIENT_URL || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export function getPrimaryClientUrl(): string | null {
  const allowed = getAllowedOrigins();
  if (allowed.length > 0) return allowed[0];
  return process.env.CLIENT_URL && process.env.CLIENT_URL.includes(',')
    ? null
    : process.env.CLIENT_URL || null;
}
