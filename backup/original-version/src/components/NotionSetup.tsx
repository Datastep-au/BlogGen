import React, { useState } from 'react';
import { ExternalLink, CheckCircle2, AlertCircle, Copy, Eye, EyeOff, Loader2, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NotionSetupProps {
  onConnectionAdded: (data: {
    workspace_name: string;
    parent_page_id: string;
    tracking_database_id: string;
    access_token: string;
  }) => void;
}

export default function NotionSetup({ onConnectionAdded }: NotionSetupProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    message: string; 
    page_title?: string;
    database_title?: string;
  } | null>(null);
  const [connectionData, setConnectionData] = useState({
    workspace_name: '',
    parent_page_id: '',
    tracking_database_id: '',
    access_token: ''
  });

  const extractPageId = (url: string) => {
    // Extract page ID from Notion URL - handle various formats
    const patterns = [
      /([a-f0-9]{32})/i, // 32 character hex string
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i // UUID format
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].replace(/-/g, ''); // Remove dashes for consistency
      }
    }
    return '';
  };

  const handlePageUrlChange = (url: string) => {
    const pageId = extractPageId(url);
    setConnectionData(prev => ({
      ...prev,
      parent_page_id: pageId
    }));
  };

  const handleDatabaseUrlChange = (url: string) => {
    const databaseId = extractPageId(url); // Same extraction logic works for databases
    setConnectionData(prev => ({
      ...prev,
      tracking_database_id: databaseId
    }));
  };

  const testConnection = async () => {
    if (!connectionData.parent_page_id || !connectionData.tracking_database_id || !connectionData.access_token) {
      setTestResult({
        success: false,
        message: 'Please provide page ID, database ID, and access token'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test both page and database connections
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
          page_id: connectionData.parent_page_id,
          database_id: connectionData.tracking_database_id,
          access_token: connectionData.access_token
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          message: result.message || 'Connection test failed'
        });
        return;
      }

      setTestResult({
        success: result.success,
        message: result.message,
        page_title: result.page_title,
        database_title: result.database_title
      });

    } catch (error) {
      console.error('Connection test error:', error);
      setTestResult({
        success: false,
        message: 'Network error: Unable to test connection. Please try again.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = () => {
    if (testResult?.success && user) {
      onConnectionAdded(connectionData);
    } else {
      alert('Please test the connection successfully before saving.');
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Please sign in to set up Notion connections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Connect Your Notion Workspace
        </h3>
        <p className="text-sm text-gray-600">
          Set up both a parent page for storing articles and a database for tracking them.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNumber 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step > stepNumber ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
              </div>
              {stepNumber < 5 && (
                <div className={`w-12 h-1 mx-2 ${
                  step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Integration</span>
          <span>Token</span>
          <span>Parent Page</span>
          <span>Database</span>
          <span>Test & Save</span>
        </div>
      </div>

      {/* Step Content */}
      {step === 1 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Step 1: Create a Notion Integration</h4>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline font-medium">notion.so/my-integrations</a></li>
              <li>Click "New integration"</li>
              <li>Give it a name like "SEO Blog Generator"</li>
              <li>Select your workspace</li>
              <li>Click "Submit"</li>
            </ol>
          </div>
          <div className="flex justify-between">
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Notion Integrations
            </a>
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Next Step
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Step 2: Copy Your Integration Token</h4>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <p className="text-sm text-yellow-800 mb-3">
              After creating your integration, copy the "Internal Integration Token" that starts with "secret_"
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Integration Token *
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={connectionData.access_token}
                    onChange={(e) => setConnectionData(prev => ({ ...prev, access_token: e.target.value }))}
                    placeholder="secret_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  value={connectionData.workspace_name}
                  onChange={(e) => setConnectionData(prev => ({ ...prev, workspace_name: e.target.value }))}
                  placeholder="My Workspace"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!connectionData.access_token || !connectionData.workspace_name}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Step 3: Choose a Parent Page</h4>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="mb-4">
              <h5 className="font-medium text-green-900 mb-2">Select or Create a Parent Page:</h5>
              <ol className="list-decimal list-inside space-y-1 text-sm text-green-800">
                <li>Go to your Notion workspace</li>
                <li>Create a new page or choose an existing one (e.g., "Blog Articles")</li>
                <li>Click the "..." menu on the page</li>
                <li>Select "Add connections" and choose your integration</li>
                <li>Copy the page URL</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Page URL *
              </label>
              <input
                type="text"
                onChange={(e) => handlePageUrlChange(e.target.value)}
                placeholder="https://notion.so/your-page-url"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {connectionData.parent_page_id && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Page ID extracted: {connectionData.parent_page_id}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Generated articles will be created as child pages under this parent page
              </p>
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!connectionData.parent_page_id}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Step 4: Create Tracking Database</h4>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="mb-4">
              <h5 className="font-medium text-purple-900 mb-2">Create a Database for Article Tracking:</h5>
              <ol className="list-decimal list-inside space-y-1 text-sm text-purple-800">
                <li>In your Notion workspace, create a new database</li>
                <li>Name it "Article Tracker" or similar</li>
                <li>Add these columns with exact names:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                    <li><strong>Article Name</strong> (Title - this will be the default)</li>
                    <li><strong>Topic</strong> (Text)</li>
                    <li><strong>Status</strong> (Select with options: Draft, Approved, Scheduled, Published)</li>
                    <li><strong>Creation Date</strong> (Date)</li>
                    <li><strong>Publish Date</strong> (Date)</li>
                  </ul>
                </li>
                <li>Share the database with your integration</li>
                <li>Copy the database URL</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tracking Database URL *
              </label>
              <input
                type="text"
                onChange={(e) => handleDatabaseUrlChange(e.target.value)}
                placeholder="https://notion.so/your-database-url"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {connectionData.tracking_database_id && (
                <p className="text-xs text-purple-600 mt-1">
                  ✓ Database ID extracted: {connectionData.tracking_database_id}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                This database will track all your generated articles
              </p>
            </div>
          </div>
          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setStep(5)}
              disabled={!connectionData.tracking_database_id}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Step 5: Test & Save Connection</h4>
          
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h5 className="font-medium text-gray-900 mb-2">Connection Summary:</h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Workspace:</span>
                <span className="font-medium">{connectionData.workspace_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Parent Page ID:</span>
                <span className="font-mono text-xs">{connectionData.parent_page_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Database ID:</span>
                <span className="font-mono text-xs">{connectionData.tracking_database_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Token:</span>
                <span className="font-mono text-xs">secret_***...***</span>
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="space-y-3">
            <button
              onClick={testConnection}
              disabled={testing || !connectionData.parent_page_id || !connectionData.tracking_database_id || !connectionData.access_token}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </button>

            {testResult && (
              <div className={`rounded-lg p-3 border ${
                testResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      testResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {testResult.message}
                    </p>
                    {testResult.success && (
                      <div className="text-xs text-green-700 mt-1 space-y-1">
                        {testResult.page_title && (
                          <p>Parent page: "{testResult.page_title}"</p>
                        )}
                        {testResult.database_title && (
                          <p>Tracking database: "{testResult.database_title}"</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={handleSaveConnection}
              disabled={!testResult?.success}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}