import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Layers } from 'lucide-react';

interface TopicFormProps {
  onSubmit: (data: { topic?: string; bulk_topics?: string[] }) => void;
  isLoading: boolean;
  remainingArticles: number;
}

export default function TopicForm({ onSubmit, isLoading, remainingArticles }: TopicFormProps) {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [singleTopic, setSingleTopic] = useState('');
  const [bulkTopics, setBulkTopics] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === 'single') {
      if (!singleTopic.trim()) return;
      onSubmit({ topic: singleTopic.trim() });
    } else {
      const topics = bulkTopics
        .split('\n')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0);
      
      if (topics.length === 0) return;
      if (topics.length > remainingArticles) {
        alert(`You can only generate ${remainingArticles} more articles this month.`);
        return;
      }
      
      onSubmit({ bulk_topics: topics });
    }
  };

  const bulkTopicsArray = bulkTopics
    .split('\n')
    .map(topic => topic.trim())
    .filter(topic => topic.length > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'single'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Single Article
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'bulk'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Bulk Generation
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'single' ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                Article Topic
              </Label>
              <Input
                id="topic"
                type="text"
                value={singleTopic}
                onChange={(e) => setSingleTopic(e.target.value)}
                placeholder="e.g., Best practices for React development"
                className="w-full"
                disabled={isLoading || remainingArticles === 0}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !singleTopic.trim() || remainingArticles === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {isLoading ? 'Generating...' : 'Generate Article'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk-topics" className="block text-sm font-medium text-gray-700 mb-2">
                Topics (one per line)
              </Label>
              <Textarea
                id="bulk-topics"
                value={bulkTopics}
                onChange={(e) => setBulkTopics(e.target.value)}
                rows={6}
                placeholder="React best practices&#10;JavaScript performance optimization&#10;CSS Grid vs Flexbox"
                className="w-full"
                disabled={isLoading || remainingArticles === 0}
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter up to {remainingArticles} topics (based on your remaining monthly limit)
                {bulkTopicsArray.length > 0 && (
                  <span className={`ml-2 ${bulkTopicsArray.length > remainingArticles ? 'text-red-600' : 'text-green-600'}`}>
                    ({bulkTopicsArray.length} topics entered)
                  </span>
                )}
              </p>
            </div>
            <Button
              type="submit"
              disabled={
                isLoading || 
                bulkTopicsArray.length === 0 || 
                bulkTopicsArray.length > remainingArticles ||
                remainingArticles === 0
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Layers className="w-5 h-5 mr-2" />
              {isLoading ? 'Generating...' : `Generate ${bulkTopicsArray.length} Articles`}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
