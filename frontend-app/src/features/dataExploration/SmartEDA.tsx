import React, { useState } from 'react';
import DataHealthTab from './DataHealthTab';
import FeatureExplorerTab from './FeatureExplorerTab';
import CorrelationTab from './CorrelationTab';
import TargetMappingTab from './TargetMappingTab';
import DataPreviewTab from './DataPreviewTab';
import MissingDataTab from './MissingDataTab';
import {
  Activity,
  Search,
  GitBranch,
  Target,
  Table,
  ShieldAlert,
} from 'lucide-react';

import type { MockEDADataset } from './mockEDAData';

interface SmartEDAProps {
  data: MockEDADataset;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const SmartEDA: React.FC<SmartEDAProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState('preview');

  const missingCount = data.missingAnalysis?.length ?? 0;

  const TABS: Tab[] = [
    { id: 'preview',     label: 'Data Preview',        icon: <Table size={15} /> },
    { id: 'health',      label: 'Data Health & Alerts', icon: <Activity size={15} /> },
    { id: 'explorer',   label: 'Feature Explorer',     icon: <Search size={15} /> },
    { id: 'correlation', label: 'Correlations',         icon: <GitBranch size={15} /> },
    { id: 'target',      label: 'Target Mapping',       icon: <Target size={15} /> },
    { id: 'missing',     label: 'Missing Data',         icon: <ShieldAlert size={15} />, badge: missingCount },
  ];

  const allColumnNames = data.columns.map((c) => c.name);

  const renderTab = () => {
    switch (activeTab) {
      case 'preview':
        return <DataPreviewTab preview={data.preview} />;
      case 'health':
        return <DataHealthTab summary={data.summary} alerts={data.alerts} columns={data.columns} />;
      case 'explorer':
        return <FeatureExplorerTab columns={data.columns} />;
      case 'correlation':
        return <CorrelationTab numericColumnNames={data.numericColumnNames} correlationMatrix={data.correlationMatrix} />;
      case 'target':
        return <TargetMappingTab columns={data.columns} />;
      case 'missing':
        return (
          <MissingDataTab
            missingAnalysis={data.missingAnalysis ?? []}
            totalRows={data.summary.numObservations}
            allColumns={allColumnNames}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Tab Bar */}
      <div className="border-b border-slate-200 bg-slate-50 px-2 pt-2 flex gap-1 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap shrink-0 border border-b-0 ${
                active
                  ? 'bg-white text-indigo-700 border-slate-200 shadow-sm -mb-px z-10'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <span className={active ? 'text-indigo-500' : 'text-slate-400'}>{tab.icon}</span>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-0.5 bg-amber-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-5 sm:p-6">
        {renderTab()}
      </div>
    </div>
  );
};

export default SmartEDA;
