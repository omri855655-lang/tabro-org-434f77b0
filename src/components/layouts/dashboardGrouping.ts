export interface DashboardTabItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export interface DashboardTabGroup {
  key: string;
  label: string;
  items: DashboardTabItem[];
}
