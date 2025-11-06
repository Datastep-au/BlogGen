import { AuthProvider } from '@/contexts/AuthContext';
import AuthGuard from '@/components/AuthGuard';
import Layout from '@/components/Layout';
import GenerateEnhanced from '@/pages/GenerateEnhanced';
import Dashboard from '@/pages/Dashboard';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import Admin from '@/pages/Admin';
import AcceptInvite from '@/pages/AcceptInvite';
import { Switch, Route as WouterRoute } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Switch>
      <WouterRoute path="/" component={LandingPage} />
      <WouterRoute path="/auth" component={AuthPage} />
      <WouterRoute path="/accept-invite" component={AcceptInvite} />
      <WouterRoute path="/app" component={() => (
        <AuthGuard>
          <Layout>
            <GenerateEnhanced />
          </Layout>
        </AuthGuard>
      )} />
      <WouterRoute path="/app/dashboard" component={() => (
        <AuthGuard>
          <Layout>
            <Dashboard />
          </Layout>
        </AuthGuard>
      )} />
      <WouterRoute path="/app/admin" component={() => (
        <AuthGuard requireAdmin>
          <Layout>
            <Admin />
          </Layout>
        </AuthGuard>
      )} />
      <WouterRoute component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AppRouter />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
