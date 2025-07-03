import React, { useState } from 'react';
import { Plus, Upload, Loader2, AlertCircle } from 'lucide-react';

interface TopicFormProps {
  onSubmit: (data: { topic?: string; bulk_topics?: string[] }) => void;
  isLoading: boolean;
  remainingArticles: number;
}

export default function TopicForm({ onSubmit, isLoading, remainingArticles }: TopicFormProps) {
  const [topic, setTopic] = useState('');
  const [bulkTopics, setBulkTopics] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'single') {
      if (!topic.trim()) return;
      if (remainingArticles < 1) return;
      onSubmit({
        topic: topic.trim()
      });
    } else {
      const topics = bulkTopics
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      if (topics.length === 0) return;
      if (topics.length > remainingArticles) return;
      onSubmit({
        bulk_topics: topics
      });
    }

    // Reset form
    setTopic('');
    setBulkTopics('');
  };

  const bulkTopicsCount = bulkTopics ? bulkTopics.split('\n').filter(t => t.trim()).length : 0;
  const canSubmit = remainingArticles > 0 && (
    mode === 'single' ? topic.trim() && remainingArticles >= 1 :
    bulkTopicsCount > 0 && bulkTopicsCount <= remainingArticles
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Generate SEO Articles</h2>
        <p className="text-gray-600">Create professional, SEO-optimized blog articles automatically</p>
      </div>

      {/* Monthly limit warning */}
      {remainingArticles === 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-800 font-medium">Monthly Limit Reached</p>
              <p className="text-sm text-red-700 mt-1">
                You've used all 10 articles for this month. Your limit will reset on the 1st of next month.
              </p>
            </div>
          </div>
        </div>
      )}

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
              disabled={remainingArticles === 0}
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
              disabled={remainingArticles === 0}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                {bulkTopicsCount} topics
              </p>
              {bulkTopicsCount > remainingArticles && remainingArticles > 0 && (
                <p className="text-xs text-red-600">
                  Too many topics! You can only generate {remainingArticles} more articles this month.
                </p>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !canSubmit}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generating Articles...
            </>
          ) : remainingArticles === 0 ? (
            'Monthly Limit Reached'
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