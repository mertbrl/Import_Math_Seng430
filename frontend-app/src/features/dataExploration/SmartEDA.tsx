import React, { useMemo, useState } from 'react';
import { Activity, GitBranch, Search, ShieldAlert, Table, Target } from 'lucide-react';
import DataHealthTab from './DataHealthTab';
import FeatureExplorerTab from './FeatureExplorerTab';
import CorrelationTab from './CorrelationTab';
import TargetMappingTab from './TargetMappingTab';
import DataPreviewTab from './DataPreviewTab';
import MissingDataTab from './MissingDataTab';
import type { MockEDADataset } from './mockEDAData';
import { useEDAStore } from '../../store/useEDAStore';
import { useDomainStore } from '../../store/useDomainStore';

interface SmartEDAProps {
  data: MockEDADataset;
}

const TABS = [
  { id: 'preview', label: 'Data Preview', icon: Table },
  { id: 'health', label: 'Data Health & Alerts', icon: Activity },
  { id: 'explorer', label: 'Feature Explorer', icon: Search },
  { id: 'correlation', label: 'Correlations', icon: GitBranch },
  { id: 'missing', label: 'Missing Data', icon: ShieldAlert },
  { id: 'target', label: 'Target Mapping', icon: Target },
] as const;

type TabId = (typeof TABS)[number]['id'];

const SmartEDA: React.FC<SmartEDAProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<TabId>('preview');
  const targetColumn = useEDAStore((state) => state.targetColumn);
  const userMode = useDomainStore((state) => state.userMode);
  const missingCount = data.missingAnalysis?.length ?? 0;

  const visibleTabs = useMemo(() => {
    return userMode === 'clinical' ? TABS.filter((t) => t.id !== 'correlation') : TABS;
  }, [userMode]);

  const renderActiveTab = useMemo(() => {
    switch (activeTab) {
      case 'preview':
        return <DataPreviewTab preview={data.preview} columns={data.columns} targetColumn={targetColumn} />;
      case 'health':
        return <DataHealthTab summary={data.summary} alerts={data.alerts} columns={data.columns} targetColumnName={targetColumn} />;
      case 'explorer':
        return <FeatureExplorerTab columns={data.columns} />;
      case 'correlation':
        return (
          <CorrelationTab
            numericColumnNames={data.numericColumnNames}
            correlationMatrix={data.correlationMatrix}
          />
        );
      case 'target':
        return (
          <TargetMappingTab
            columns={data.columns}
            totalRows={data.summary.numObservations}
            allColumnNames={data.preview.headers}
            previewRows={data.preview.rows}
          />
        );
      case 'missing':
        return (
          <MissingDataTab
            missingAnalysis={data.missingAnalysis ?? []}
            totalRows={data.summary.numObservations}
            allColumns={data.columns.map((column) => column.name)}
          />
        );
      default:
        return null;
    }
  }, [activeTab, data, targetColumn]);

  return (
    <div className="space-y-6">
      <div className="ha-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface2)] px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tab.id === 'missing' ? missingCount : undefined;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="ha-tab-pill inline-flex items-center gap-2"
                  data-active={isActive}
                >
                  <Icon size={15} />
                  {tab.label}
                  {badge ? (
                    <span className={`ha-badge ${isActive ? 'bg-white/18 text-white' : 'bg-amber-100 text-amber-800'}`}>
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div key={activeTab} className="ha-animate-in">
            {renderActiveTab}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartEDA;
