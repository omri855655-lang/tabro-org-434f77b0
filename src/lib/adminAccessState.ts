export function canLoadAdminData(authLoading: boolean, userPresent: boolean, unlocked: boolean): boolean {
  return !authLoading && userPresent && unlocked;
}
