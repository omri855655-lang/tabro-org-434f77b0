export const FIVE_MINUTES = 5 * 60 * 1000;

export const dashboardRefresh = {
  staleTime: FIVE_MINUTES,
  gcTime: 2 * FIVE_MINUTES,
  refetchOnWindowFocus: false,
  refetchInterval: (query: { state: { dataUpdatedAt: number; status: string } }) =>
    query.state.dataUpdatedAt && query.state.status === 'success'
      ? Math.max(1000, FIVE_MINUTES - (Date.now() - query.state.dataUpdatedAt)) : FIVE_MINUTES,
};
