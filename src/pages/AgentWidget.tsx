import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import TabroAiAgent from "@/components/TabroAiAgent";

/**
 * Standalone AI Agent page — designed to be bookmarked on iPhone home screen.
 * Opens directly to the AI agent chat in a minimal UI.
 */
const AgentWidget = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* The TabroAiAgent component is the floating agent - we render it always open */}
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
        <div className="w-full max-w-lg h-[90vh] rounded-2xl border bg-card shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b bg-primary/5">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">🤖</div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Tabro AI</h1>
              <p className="text-xs text-muted-foreground">Your personal AI assistant</p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
            <div>
              <p className="text-4xl mb-4">🤖</p>
              <p>Open the Tabro AI agent from the floating button below</p>
              <p className="text-xs mt-2 opacity-60">Bookmark this page to your home screen for quick access</p>
            </div>
          </div>
        </div>
      </div>
      <TabroAiAgent />
    </div>
  );
};

export default AgentWidget;
