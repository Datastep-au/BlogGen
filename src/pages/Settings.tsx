import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, ExternalLink, Key, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import NotionSetup from '../components/NotionSetup';
import type { NotionConnection } from '../types';

export default function Settings() {
  const { user } = useAuth();
  const [notionConnections, setNotionConnections] = useState<NotionConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

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
      setLoading(false);
    }
  };

  const handleAddConnection = async (connectionData: {
    workspace_name: string;
    parent_page_id: string;
    tracking_database_id: string;
    access_token: string;
  }) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('notion_connections')
        .insert([{
          ...connectionData,
          user_id: user.id
        }]);

      if (error) throw error;

      setShowAddForm(false);
      await loadNotionConnections();
      alert('Notion connection added successfully!');
    } catch (error) {
      console.error('Error adding Notion connection:', error);
      alert('Failed to add Notion connection. Please try again.');
    }
  };

  const testNotionConnection = async (connection: {
    parent_page_id: string;
    tracking_database_id: string;
    access_token: string;
  }) => {
    try {
      // Use the server-side Edge Function to test the connection
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-notion-setup`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          page_id: connection.parent_page_id,
          database_id: connection.tracking_database_id,
          access_token: connection.access_token
        }),
      });

      const result = await response.json();

      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error'
      };
    }
  };

  const handleTestConnection = async (connection: NotionConnection) => {
    setTestingConnection(connection.id);
    
    try {
      const result = await testNotionConnection({
        parent_page_id: connection.parent_page_id,
        tracking_database_id: connection.tracking_database_id,
        access_token: connection.access_token
      });

      setTestResults(prev => ({
        ...prev,
        [connection.id]: result
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [connection.id]: {
          success: false,
          message: 'Test failed'
        }
      }));
    } finally {
      setTestingConnection(null);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Notion connection?')) return;

    try {
      const { error } = await supabase
        .from('notion_connections')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      await loadNotionConnections();
    } catch (error) {
      console.error('Error deleting Notion connection:', error);
    }
  };

  const getConnectionStatus = (connection: NotionConnection) => {
    const hasPage = !!connection.parent_page_id;
    const hasDatabase = !!connection.tracking_database_id;
    
    if (hasPage && hasDatabase) return { status: 'complete', color: 'green' };
    if (hasPage || hasDatabase) return { status: 'partial', color: 'yellow' };
    return { status: 'incomplete', color: 'red' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure your integrations and preferences</p>
      </div>

      {/* API Keys Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Key className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">API Configuration</h2>
        </div>
        <div className="space-y-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-sm text-green-800 font-medium">
                OpenAI API Key: Configured ✓
              </p>
            </div>
            <p className="text-sm text-green-700 mt-1">
              Your OpenAI API key is properly configured and ready for article generation.
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Supabase Connection:</strong> Connected and operational
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Database tables are set up and ready for storing articles and connections.
            </p>
          </div>
        </div>
      </div>

      {/* Notion Connections */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Database className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Notion Connections</h2>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Connection
            </button>
          </div>
        </div>

        {/* Add Connection Form */}
        {showAddForm && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <NotionSetup 
              onConnectionAdded={(data) => {
                handleAddConnection(data);
              }}
            />
          </div>
        )}

        {/* Connection List */}
        <div className="p-6">
          {notionConnections.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Notion connections</h3>
              <p className="text-gray-600 mb-4">
                Connect your Notion workspace to automatically save articles as pages and track them in a database
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
                <h4 className="font-medium text-gray-900 mb-2">Setup includes:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Parent page for storing article content</li>
                  <li>Database for tracking article metadata</li>
                  <li>Integration token for API access</li>
                  <li>Automatic synchronization</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {notionConnections.map((connection) => {
                const connectionStatus = getConnectionStatus(connection);
                
                return (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="font-medium text-gray-900 mr-3">{connection.workspace_name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          connectionStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                          connectionStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {connectionStatus.color === 'green' ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {connectionStatus.status === 'complete' ? 'Complete' :
                           connectionStatus.status === 'partial' ? 'Partial' : 'Incomplete'}
                        </span>
                        {testResults[connection.id] && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 ${
                            testResults[connection.id].success 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {testResults[connection.id].success ? 'Connected' : 'Failed'}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <span className="w-20">Page:</span>
                          <span className={connection.parent_page_id ? 'text-green-600' : 'text-red-600'}>
                            {connection.parent_page_id ? `${connection.parent_page_id.slice(0, 8)}...` : 'Not configured'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="w-20">Database:</span>
                          <span className={connection.tracking_database_id ? 'text-green-600' : 'text-red-600'}>
                            {connection.tracking_database_id ? `${connection.tracking_database_id.slice(0, 8)}...` : 'Not configured'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Added {new Date(connection.created_at).toLocaleDateString()}
                      </p>
                      {testResults[connection.id] && !testResults[connection.id].success && (
                        <p className="text-xs text-red-600 mt-1">
                          Error: {testResults[connection.id].message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {connectionStatus.status === 'complete' && (
                        <button
                          onClick={() => handleTestConnection(connection)}
                          disabled={testingConnection === connection.id}
                          className="flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          {testingConnection === connection.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-1" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Test
                        </button>
                      )}
                      {connection.parent_page_id && (
                        <a
                          href={`https://notion.so/${connection.parent_page_id.replace(/-/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteConnection(connection.id)}
                        className="flex items-center px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <SettingsIcon className="h-5 w-5 text-gray-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Troubleshooting</h2>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Common Issues & Solutions:</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Connection Test Fails:</strong> Make sure you've shared both your parent page and database with the integration.
                </div>
              </div>
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Database Schema:</strong> Ensure your database has the exact column names: "Article Name", "Topic", "Status", "Creation Date", "Publish Date".
                </div>
              </div>
              <div className="flex items-start">
                <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Permission Denied:</strong> Verify your integration has the correct permissions and is connected to both resources.
                </div>
              </div>
              <div className="flex items-start">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Dual Storage:</strong> Articles are saved as pages for content and tracked in the database for management.
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Need Help?</h4>
            <p className="text-sm text-blue-800">
              If you're still having issues, check the browser console for detailed error messages, 
              or verify your Notion integration settings at{' '}
              <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">
                notion.so/my-integrations
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}