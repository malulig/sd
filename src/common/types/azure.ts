export interface AzureIdTokenClaims {
  oid?: string;
  tid?: string;
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  emails?: string[];
}

export function extractEmail(claims: AzureIdTokenClaims): string | null {
  if (claims.email && claims.email.trim()) return claims.email.trim();
  if (claims.preferred_username && claims.preferred_username.trim()) {
    return claims.preferred_username.trim();
  }
  if (Array.isArray(claims.emails) && claims.emails[0]?.trim()) {
    return claims.emails[0].trim();
  }
  return null;
}
