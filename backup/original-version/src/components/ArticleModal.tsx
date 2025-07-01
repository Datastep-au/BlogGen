import React, { useState } from 'react';
import { X, Save, Calendar, ExternalLink } from 'lucide-react';
import type { Article } from '../types';

interface ArticleModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (article: Article) => void;
  onSchedule?: (article: Article, date: string) => void;
  mode: 'view' | 'edit' | 'schedule';
}

export default function ArticleModal({ 
  article, 
  isOpen, 
  onClose, 
  onSave, 
  onSchedule, 
  mode 
}: ArticleModalProps) {
  const [editedArticle, setEditedArticle] = useState<Article | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');

  React.useEffect(() => {
    if (article) {
      setEditedArticle({ ...article });
      setScheduledDate(article.scheduled_date || '');
    }
  }, [article]);

  if (!isOpen || !article || !editedArticle) return null;

  const handleSave = () => {
    if (onSave && editedArticle) {
      onSave(editedArticle);
    }
    onClose();
  };

  const handleSchedule = () => {
    if (onSchedule && scheduledDate) {
      onSchedule(article, scheduledDate);
    }
    onClose();
  };

  const updateField = (field: keyof Article, value: any) => {
    setEditedArticle(prev => prev ? { ...prev, [field]: value } : null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'view' ? 'View Article' : mode === 'edit' ? 'Edit Article' : 'Schedule Article'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {mode === 'schedule' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{article.title}</h3>
                <p className="text-gray-600 mb-4">{article.meta_description}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={!scheduledDate}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Article
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                {mode === 'edit' ? (
                  <input
                    type="text"
                    value={editedArticle.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta Description
                </label>
                {mode === 'edit' ? (
                  <textarea
                    value={editedArticle.meta_description}
                    onChange={(e) => updateField('meta_description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-600">{article.meta_description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords
                </label>
                {mode === 'edit' ? (
                  <input
                    type="text"
                    value={editedArticle.keywords.join(', ')}
                    onChange={(e) => updateField('keywords', e.target.value.split(',').map(k => k.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {article.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                {mode === 'edit' ? (
                  <textarea
                    value={editedArticle.content}
                    onChange={(e) => updateField('content', e.target.value)}
                    rows={20}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                ) : (
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                      {article.content}
                    </pre>
                  </div>
                )}
              </div>

              {article.notion_page_id && (
                <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                  <ExternalLink className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm text-blue-700">
                    This article has been saved to Notion
                  </span>
                </div>
              )}

              {mode === 'edit' && (
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}