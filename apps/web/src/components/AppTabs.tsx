export interface TabItem {
  key: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

interface AppTabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function AppTabs({ tabs, active, onChange }: AppTabsProps) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-800 sm:mb-6">
      {tabs.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'border-violet-400 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
