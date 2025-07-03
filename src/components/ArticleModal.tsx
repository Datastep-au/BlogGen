import React, { useState } from 'react';
import { X, Save, Copy, CheckCircle2 } from 'lucide-react';
import type { Article } from '../types';

interface ArticleModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (article: Article) => void;
  mode: 'view' | 'edit';
}

export default function ArticleModal({ 
  article, 
  isOpen, 
  onClose, 
  onSave, 
  mode 
}: ArticleModalProps) {
  const [editedArticle, setEditedArticle] = useState<Article | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  React.useEffect(() => {
    if (article) {
      setEditedArticle({ ...article });
    }
  }, [article]);

  if (!isOpen || !article || !editedArticle) return null;

  const handleSave = () => {
    if (onSave && editedArticle) {
      onSave(editedArticle);
    }
    onClose();
  };

  const updateField = (field: keyof Article, value: any) => {
    setEditedArticle(prev => prev ? { ...prev, [field]: value } : null);
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {mode === 'view' ? 'View Article' : 'Edit Article'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                {mode === 'view' && (
                  <button
                    onClick={() => copyToClipboard(article.title, 'title')}
                    className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'title' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copy
                  </button>
                )}
              </div>
              {mode === 'edit' ? (
                <input
                  type="text"
                  value={editedArticle.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{article.title}</h1>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Meta Description
                </label>
                {mode === 'view' && (
                  <button
                    onClick={() => copyToClipboard(article.meta_description, 'meta')}
                    className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'meta' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copy
                  </button>
                )}
              </div>
              {mode === 'edit' ? (
                <textarea
                  value={editedArticle.meta_description}
                  onChange={(e) => updateField('meta_description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              ) : (
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg text-sm">{article.meta_description}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Keywords
                </label>
                {mode === 'view' && (
                  <button
                    onClick={() => copyToClipboard(article.keywords.join(', '), 'keywords')}
                    className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'keywords' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copy
                  </button>
                )}
              </div>
              {mode === 'edit' ? (
                <input
                  type="text"
                  value={editedArticle.keywords.join(', ')}
                  onChange={(e) => updateField('keywords', e.target.value.split(',').map(k => k.trim()))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Content
                </label>
                {mode === 'view' && (
                  <button
                    onClick={() => copyToClipboard(article.content, 'content')}
                    className="flex items-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    {copied === 'content' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    Copy All
                  </button>
                )}
              </div>
              {mode === 'edit' ? (
                <textarea
                  value={editedArticle.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  rows={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs sm:text-sm"
                />
              ) : (
                <div className="prose max-w-none bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-700 leading-relaxed font-sans">
                    {article.content}
                  </pre>
                </div>
              )}
            </div>

            {mode === 'edit' && (
              <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}