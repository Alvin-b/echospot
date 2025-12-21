
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import PlanDisplay from './components/PlanDisplay';
import MaintenanceManager from './components/MaintenanceManager';
import IssuesLog from './components/IssuesLog';
import EvolutionConfigComp from './components/EvolutionConfig';
import BroadcastManager from './components/BroadcastManager';
import WebhookDebugger from './components/WebhookDebugger';
import SystemTerminal from './components/SystemTerminal';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/terminal" element={<SystemTerminal />} />
          <Route path="/debug" element={<WebhookDebugger />} />
          <Route path="/issues" element={<IssuesLog />} />
          <Route path="/broadcast" element={<BroadcastManager />} />
          <Route path="/simulator" element={<ChatInterface />} />
          <Route path="/maintenance" element={<MaintenanceManager />} />
          <Route path="/plans" element={<PlanDisplay />} />
          <Route path="/settings" element={<EvolutionConfigComp />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
