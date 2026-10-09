/** Exact user IDs keep paid AI calls restricted to the pilot accounts. */
export function aiUserAllowed(userId: string, configuredIds = process.env.TALENTIA_AI_USER_IDS): boolean {
  if (!userId || !configuredIds) return false;
  const ids = configuredIds.split(',').map(id => id.trim()).filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  return ids.includes(userId);
}
