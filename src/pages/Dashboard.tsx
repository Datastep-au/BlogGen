import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, CheckCircle2, Search, Filter } from 'lucide-react';
import ArticleCard from '../components/ArticleCard';
import ArticleModal from '../components/ArticleModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Article } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadArticles();
    }
  }, [user]);

  useEffect(() => {
    filterArticles();
  }, [articles, searchTerm, statusFilter]);

  const loadArticles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterArticles = () => {
    let filtered = articles;

    if (searchTerm) {
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        article.keywords.some(keyword => 
          keyword.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(article => article.status === statusFilter);
    }

    setFilteredArticles(filtered);
  };

  const handleViewArticle = (article: Article) => {
    setSelectedArticle(article);
    setModalMode('view');
  };

  const handleEditArticle = (article: Article) => {
    setSelectedArticle(article);
    setModalMode('edit');
  };

  const handleSaveArticle = async (article: Article) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({
          title: article.title,
          content: article.content,
          meta_description: article.meta_description,
          keywords: article.keywords,
          updated_at: new Date().toISOString()
        })
        .eq('id', article.id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      await loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
    }
  };

  const handleStatusChange = () => {
    loadArticles();
  };

  const getStats = () => {
    const totalArticles = articles.length;
    const drafts = articles.filter(a => a.status === 'draft').length;
    const published = articles.filter(a => a.status === 'published').length;
    const approved = articles.filter(a => a.status === 'approved').length;

    return { totalArticles, drafts, published, approved };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Manage your SEO articles and track their performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalArticles}</p>
              <p className="text-xs sm:text-sm text-gray-600">Total Articles</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.drafts}</p>
              <p className="text-xs sm:text-sm text-gray-600">Drafts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center">
            <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.approved}</p>
              <p className="text-xs sm:text-sm text-gray-600">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center">
            <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.published}</p>
              <p className="text-xs sm:text-sm text-gray-600">Published</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1 sm:flex-none">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="relative">
              <Filter className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-gray-600 text-center sm:text-right">
            Showing {filteredArticles.length} of {articles.length} articles
          </p>
        </div>
      </div>

      {/* Articles Grid */}
      {filteredArticles.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
          <p className="text-gray-600">
            {articles.length === 0 
              ? "Get started by generating your first article"
              : "Try adjusting your search or filter criteria"
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onView={handleViewArticle}
              onEdit={handleEditArticle}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Article Modal */}
      <ArticleModal
        article={selectedArticle}
        isOpen={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onSave={handleSaveArticle}
        mode={modalMode}
      />
    </div>
  );
}