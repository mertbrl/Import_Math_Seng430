import React, { useState } from 'react';
import DataHealthTab from './DataHealthTab';
import FeatureExplorerTab from './FeatureExplorerTab';
import CorrelationTab from './CorrelationTab';
import TargetMappingTab from './TargetMappingTab';
import {
  Activity,
  Search,
  GitBranch,
  Target,
} from 'lucide-react';

import type { MockEDADataset } from './mockEDAData';

interface SmartEDAProps {
  data: MockEDADataset;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'health', label: 'Data Health & Alerts', icon: <Activity size={15} /> },
  { id: 'explorer', label: 'Feature Explorer', icon: <Search size={15} /> },
  { id: 'correlation', label: 'Correlations', icon: <GitBranch size={15} /> },
  { id: 'target', label: 'Target Mapping', icon: <Target size={15} /> },
];

const SmartEDA: React.FC<SmartEDAProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState('health');

  const renderTab = () => {
    switch (activeTab) {
      case 'health': return <DataHealthTab summary={data.summary} alerts={data.alerts} />;
      case 'explorer': return <FeatureExplorerTab columns={data.columns} />;
      case 'correlation': return <CorrelationTab numericColumnNames={data.numericColumnNames} correlationMatrix={data.correlationMatrix} />;
      case 'target': return <TargetMappingTab columns={data.columns} />;
      default: return null;
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
