export function isAdminUsername(username: string | undefined | null): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  return !!adminUsername && username === adminUsername;
}
