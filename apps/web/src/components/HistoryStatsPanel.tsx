import { useHistoryData } from '../hooks/useHistoryData';
import { StatsTab } from './StatsTab';
import { HistoryTab } from './HistoryTab';
import ClassicLoader from './ui/loader';

interface HistoryStatsPanelProps {
  tab: 'stats' | 'history';
}

export function HistoryStatsPanel({ tab }: HistoryStatsPanelProps) {
  const { drops, counters, error } = useHistoryData();

  if ((!drops || !counters) && !error) {
    return (
      <div className="flex justify-center py-10">
        <ClassicLoader />
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-red-400">Nepodařilo se načíst data: {error}</p>}
      {drops && counters && (tab === 'stats' ? <StatsTab drops={drops} counters={counters} /> : <HistoryTab drops={drops} />)}
    </div>
  );
}
