import React from 'react';
import { Calendar, Eye, Edit3, Copy, CheckCircle2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Article } from '../types';

interface ArticleCardProps {
  article: Article;
  onView: (article: Article) => void;
  onEdit: (article: Article) => void;
  onStatusChange: () => void;
}

export default function ArticleCard({ article, onView, onEdit, onStatusChange }: ArticleCardProps) {
  const { user } = useAuth();
  const [copied, setCopied] = React.useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'published':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!user) return;
    
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('articles')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', article.id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      onStatusChange();
      setShowStatusDropdown(false);
    } catch (error) {
      console.error('Error updating article status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'approved', label: 'Approved' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'published', label: 'Published' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
            {article.title}
          </h3>
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {article.meta_description}
          </p>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={updatingStatus}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors hover:shadow-sm ${getStatusColor(article.status)} ${updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
              >
                <span className="capitalize">{article.status}</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
              
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                        option.value === article.status ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      } ${option.value === statusOptions[0].value ? 'rounded-t-md' : ''} ${
                        option.value === statusOptions[statusOptions.length - 1].value ? 'rounded-b-md' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {article.scheduled_date && (
              <div className="flex items-center text-xs text-gray-500">
                <Calendar className="h-3 w-3 mr-1" />
                {format(new Date(article.scheduled_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {article.keywords.slice(0, 3).map((keyword, index) => (
          <span
            key={index}
            className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium"
          >
            {keyword}
          </span>
        ))}
        {article.keywords.length > 3 && (
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-500 text-xs font-medium">
            +{article.keywords.length - 3} more
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
        <span>Topic: {article.topic}</span>
        <span>Created {format(new Date(article.created_at), 'MMM d')}</span>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onView(article)}
          className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </button>
        <button
          onClick={() => onEdit(article)}
          className="flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
        >
          <Edit3 className="h-4 w-4 mr-1" />
          Edit
        </button>
        <button
          onClick={() => copyToClipboard(article.content)}
          className="flex items-center px-3 py-1.5 text-sm text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors"
        >
          {copied ? (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          ) : (
            <Copy className="h-4 w-4 mr-1" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Click outside to close dropdown */}
      {showStatusDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowStatusDropdown(false)}
        />
      )}
    </div>
  );
}