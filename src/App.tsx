import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import Generate from './pages/Generate';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AuthGuard>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Generate />} />
              <Route path="dashboard" element={<Dashboard />} />
            </Route>
          </Routes>
        </AuthGuard>
      </Router>
    </AuthProvider>
  );
}

export default App;