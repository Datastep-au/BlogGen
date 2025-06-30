import React, { useState, useEffect } from 'react';
import { Plus, Upload, Loader2, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { NotionConnection } from '../types';

interface TopicFormProps {
  onSubmit: (data: { topic?: string; bulk_topics?: string[]; notion_parent_page_id?: string }) => void;
  isLoading: boolean;
}

export default function TopicForm({ onSubmit, isLoading }: TopicFormProps) {
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [bulkTopics, setBulkTopics] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [notionConnections, setNotionConnections] = useState<NotionConnection[]>([]);
  const [selectedParentPage, setSelectedParentPage] = useState('');
  const [loadingConnections, setLoadingConnections] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotionConnections();
    }
  }, [user]);

  const loadNotionConnections = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notion_connections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotionConnections(data || []);
    } catch (error) {
      console.error('Error loading Notion connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'single') {
      if (!topic.trim()) return;
      onSubmit({
        topic: topic.trim(),
        notion_parent_page_id: selectedParentPage || undefined
      });
    } else {
      const topics = bulkTopics
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      if (topics.length === 0) return;
      onSubmit({
        bulk_topics: topics,
        notion_parent_page_id: selectedParentPage || undefined
      });
    }

    // Reset form
    setTopic('');
    setBulkTopics('');
  };

  const getConnectionStatus = () => {
    const completeConnections = notionConnections.filter(conn => 
      conn.parent_page_id && conn.tracking_database_id
    );
    return {
      total: notionConnections.length,
      complete: completeConnections.length,
      hasComplete: completeConnections.length > 0
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Generate SEO Articles</h2>
        <p className="text-gray-600">Create professional, SEO-optimized blog articles automatically</p>
      </div>

      {/* Notion Connection Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-3 ${
              connectionStatus.hasComplete ? 'bg-green-500' : 
              connectionStatus.total > 0 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-sm font-medium text-gray-700">
              Notion Integration
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {loadingConnections ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : connectionStatus.hasComplete ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
            <Database className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        {!loadingConnections && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-500">
              {connectionStatus.hasComplete 
                ? `${connectionStatus.complete} complete workspace${connectionStatus.complete > 1 ? 's' : ''} connected`
                : connectionStatus.total > 0
                ? `${connectionStatus.total} workspace${connectionStatus.total > 1 ? 's' : ''} partially configured`
                : 'No workspaces connected'
              }
            </p>
            {connectionStatus.hasComplete && (
              <p className="text-xs text-green-600">
                ✓ Articles will be saved as pages + tracked in database
              </p>
            )}
            {!connectionStatus.hasComplete && connectionStatus.total > 0 && (
              <p className="text-xs text-yellow-600">
                ⚠ Complete setup in Settings to enable Notion integration
              </p>
            )}
          </div>
        )}
      </div>

      {/* Mode Selection */}
      <div className="mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Single Topic
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'bulk'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Bulk Topics
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Parent Page Selection */}
        {connectionStatus.hasComplete && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notion Workspace (Optional)
            </label>
            <select
              value={selectedParentPage}
              onChange={(e) => setSelectedParentPage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a workspace...</option>
              {notionConnections
                .filter(conn => conn.parent_page_id && conn.tracking_database_id)
                .map((conn) => (
                  <option key={conn.id} value={conn.parent_page_id}>
                    {conn.workspace_name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Articles will be saved as pages and tracked in your database
            </p>
          </div>
        )}

        {/* Topic Input */}
        {mode === 'single' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Article Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic for your blog article..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bulk Topics (one per line)
            </label>
            <textarea
              value={bulkTopics}
              onChange={(e) => setBulkTopics(e.target.value)}
              placeholder="Enter multiple topics, one per line:&#10;How to optimize website performance&#10;Best practices for SEO in 2024&#10;Content marketing strategies"
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {bulkTopics ? bulkTopics.split('\n').filter(t => t.trim()).length : 0} topics
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || (mode === 'single' ? !topic.trim() : !bulkTopics.trim())}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generating Articles...
            </>
          ) : (
            <>
              {mode === 'single' ? <Plus className="h-5 w-5 mr-2" /> : <Upload className="h-5 w-5 mr-2" />}
              {mode === 'single' ? 'Generate Article' : 'Generate All Articles'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}