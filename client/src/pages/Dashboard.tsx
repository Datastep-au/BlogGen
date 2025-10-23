import { useState, useEffect } from 'react';
import { FileText, TrendingUp, Edit, Clock, Calendar as CalendarIcon, Eye, Type, Search, Download, Copy, Trash2, ChevronLeft, ChevronRight, MoreVertical, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ArticleEditor from '@/components/ArticleEditor';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Article } from '@shared/schema';

export default function Dashboard() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [viewingArticle, setViewingArticle] = useState<Article | null>(null);
  const [copyingArticle, setCopyingArticle] = useState<Article | null>(null);
  const [siteInfo, setSiteInfo] = useState<any>(null);
  const [stats, setStats] = useState({
    total: 0,
    drafts: 0,
    scheduled: 0,
    published: 0
  });

  useEffect(() => {
    fetchArticles();
    fetchStats();
    fetchSiteInfo();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch('/api/articles', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      
      const data = await response.json();
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch articles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!session?.access_token) {
        console.error('Error fetching stats: Not authenticated');
        return;
      }
      
      const response = await fetch('/api/articles', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      
      if (!response.ok) {
        console.error('Error fetching stats');
        return;
      }
      
      const data = await response.json();

      const total = data?.length || 0;
      const drafts = data?.filter((article: Article) => article.status === 'draft').length || 0;
      const scheduled = data?.filter((article: Article) => article.status === 'scheduled').length || 0;
      const published = data?.filter((article: Article) => article.status === 'published').length || 0;

      setStats({ total, drafts, scheduled, published });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchSiteInfo = async () => {
    try {
      if (!session?.access_token) {
        return;
      }

      const profileResponse = await fetch('/api/user/profile', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!profileResponse.ok) {
        return;
      }

      const profile = await profileResponse.json();

      if (profile.client_id) {
        const siteResponse = await fetch(`/api/client/${profile.client_id}/site`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          }
        });

        if (siteResponse.ok) {
          const siteData = await siteResponse.json();
          setSiteInfo(siteData);
        }
      }
    } catch (error) {
      console.error('Error fetching site info:', error);
    }
  };

  const handleViewArticle = (article: Article) => {
    setViewingArticle(article);
  };

  const handleEditArticle = (article: Article) => {
    setEditingArticle(article);
  };

  const handleSaveArticle = async (articleData: Partial<Article>) => {
    if (!editingArticle || !session?.access_token) return;

    try {
      const response = await fetch(`/api/articles/${editingArticle.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: articleData.title,
          content: articleData.content,
          meta_description: articleData.meta_description,
          keywords: articleData.keywords,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      toast({
        title: 'Success',
        description: 'Article updated successfully',
      });

      setEditingArticle(null);
      await fetchArticles();
      await fetchStats();
    } catch (error) {
      console.error('Error updating article:', error);
      toast({
        title: 'Error',
        description: 'Failed to update article',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteArticle = async (articleId: number) => {
    if (!confirm('Are you sure you want to delete this article?') || !session?.access_token) return;

    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      toast({
        title: 'Success',
        description: 'Article deleted successfully',
      });

      await fetchArticles();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete article',
        variant: 'destructive',
      });
    }
  };

  const handleCopyArticle = (article: Article) => {
    setCopyingArticle(article);
  };

  const [downloadingArticleId, setDownloadingArticleId] = useState<number | null>(null);

  const handleDownloadZip = async (article: Article) => {
    if (downloadingArticleId) return; // Prevent duplicate downloads
    
    setDownloadingArticleId(article.id);
    try {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/articles/${article.id}/export`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download article');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${article.slug || `article-${article.id}`}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Article downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading article:', error);
      toast({
        title: 'Error',
        description: 'Failed to download article',
        variant: 'destructive',
      });
    } finally {
      setDownloadingArticleId(null);
    }
  };

  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Success',
        description: `${description} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to copy ${description.toLowerCase()}`,
        variant: 'destructive',
      });
    }
  };

  const copyAllContent = async (article: Article) => {
    const fullContent = `${article.title}

${article.meta_description || ''}

Keywords: ${(article.keywords || []).join(', ')}

${article.content}`;
    
    await copyToClipboard(fullContent, 'Complete article');
  };

  const handleStatusChange = async (articleId: number, newStatus: string) => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update article status');
      }

      toast({
        title: 'Success',
        description: `Article status updated to ${newStatus}`,
      });

      await fetchArticles();
      await fetchStats();
    } catch (error) {
      console.error('Error updating article status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update article status',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    try {
      // Create CSV headers
      const headers = [
        'Date Created',
        'Topic',
        'Word Count',
        'Article Title',
        'Status',
        'Status Update Date'
      ];

      // Create CSV rows
      const rows = articles.map(article => [
        format(new Date(article.created_at), 'yyyy-MM-dd HH:mm:ss'),
        `"${article.topic.replace(/"/g, '""')}"`, // Escape quotes in topic
        article.content ? Math.round(article.content.split(' ').length) : 0,
        `"${article.title.replace(/"/g, '""')}"`, // Escape quotes in title
        article.status,
        format(new Date(article.updated_at), 'yyyy-MM-dd HH:mm:ss')
      ]);

      // Combine headers and rows
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `bloggen-articles-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Success',
        description: 'Articles exported to CSV successfully',
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to export articles to CSV',
        variant: 'destructive',
      });
    }
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.topic.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || article.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  if (copyingArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Copy Article</h1>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setCopyingArticle(null)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() => copyAllContent(copyingArticle)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy All
              </Button>
            </div>
          </div>
          
          {/* Title Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Title</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(copyingArticle.title, 'Title')}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {copyingArticle.title}
            </h2>
          </div>

          {/* Meta Description Section */}
          {copyingArticle.meta_description && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Meta Description</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(copyingArticle.meta_description || '', 'Meta description')}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <p className="text-gray-700">
                {copyingArticle.meta_description}
              </p>
            </div>
          )}

          {/* Keywords Section */}
          {copyingArticle.keywords && copyingArticle.keywords.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Keywords</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard((copyingArticle.keywords || []).join(', '), 'Keywords')}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {copyingArticle.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Content Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Content</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(copyingArticle.content, 'Article content')}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy All
              </Button>
            </div>
            <div className="prose prose-lg max-w-none">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: copyingArticle.content.replace(/\n/g, '<br />') 
                }} 
              />
            </div>
          </div>
          
          <div className="pt-6 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Topic: {copyingArticle.topic}</span>
              <span>
                {copyingArticle.content ? Math.round(copyingArticle.content.split(' ').length) : 0} words
              </span>
              <span>{format(new Date(copyingArticle.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewingArticle) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {viewingArticle.hero_image_url && (
            <div className="relative">
              <img 
                src={viewingArticle.hero_image_url} 
                alt={viewingArticle.title}
                className="w-full h-96 object-cover"
                data-testid="img-article-hero"
              />
              <div className="absolute bottom-4 right-4">
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingArticle.hero_image_url || '');
                    toast({
                      title: "Image URL copied!",
                      description: "The hero image URL has been copied to your clipboard."
                    });
                  }}
                  data-testid="button-copy-image-url"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Image URL
                </Button>
              </div>
            </div>
          )}
          
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <Badge
                variant="secondary"
                className={`${
                  viewingArticle.status === 'published' 
                    ? 'bg-purple-100 text-purple-800' 
                    : viewingArticle.status === 'scheduled'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {viewingArticle.status === 'published' ? 'Published' : 
                 viewingArticle.status === 'scheduled' ? 'Scheduled' : 'Draft'}
              </Badge>
              <Button
                variant="outline"
                onClick={() => setViewingArticle(null)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Dashboard
              </Button>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {viewingArticle.title}
            </h1>
          
          {viewingArticle.meta_description && (
            <p className="text-lg text-gray-600 mb-6 p-4 bg-gray-50 rounded-lg">
              {viewingArticle.meta_description}
            </p>
          )}
          
          <div className="prose prose-lg max-w-none">
            <div 
              dangerouslySetInnerHTML={{ 
                __html: viewingArticle.content.replace(/\n/g, '<br />') 
              }} 
            />
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Topic: {viewingArticle.topic}</span>
              <span>
                {viewingArticle.content ? Math.round(viewingArticle.content.split(' ').length) : 0} words
              </span>
              <span>{format(new Date(viewingArticle.created_at), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingArticle(viewingArticle);
                  setViewingArticle(null);
                }}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCopyingArticle(viewingArticle);
                  setViewingArticle(null);
                }}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  if (editingArticle) {
    return (
      <ArticleEditor
        article={editingArticle}
        onSave={handleSaveArticle}
        onCancel={() => setEditingArticle(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Article Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage and edit your generated articles for your dedicated site</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button 
            variant="outline" 
            className="flex items-center"
            onClick={handleExportCSV}
            disabled={articles.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Site Information (for non-admin users) */}
      {siteInfo && user?.role !== 'admin' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Globe className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900" data-testid="text-site-name">
                  {siteInfo.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">Connected Site</p>
              </div>
            </div>
            <Badge 
              variant={siteInfo.is_active ? "default" : "secondary"}
              data-testid="badge-site-status"
            >
              {siteInfo.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Domain</p>
              <p className="text-sm font-medium text-gray-900 mt-1" data-testid="text-site-domain">
                {siteInfo.domain || 'Not configured'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Storage Bucket</p>
              <p className="text-sm font-medium text-gray-900 mt-1" data-testid="text-site-bucket">
                {siteInfo.storage_bucket_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Articles</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Edit className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Drafts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.drafts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Scheduled</p>
              <p className="text-2xl font-bold text-gray-900">{stats.scheduled}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Published</p>
              <p className="text-2xl font-bold text-gray-900">{stats.published}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="grid gap-6">
        {filteredArticles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
            <p className="text-gray-600">
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Start by generating your first article!'
              }
            </p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <div
              key={article.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              {article.hero_image_url && (
                <img 
                  src={article.hero_image_url} 
                  alt={article.title}
                  className="w-full h-48 object-cover"
                  data-testid={`img-hero-${article.id}`}
                />
              )}
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer">
                        {article.title}
                      </h3>
                    <Badge
                      variant="secondary"
                      className={`ml-4 ${
                        article.status === 'published' 
                          ? 'bg-purple-100 text-purple-800' 
                          : article.status === 'scheduled'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {article.status === 'published' ? 'Published' : 
                       article.status === 'scheduled' ? 'Scheduled' : 'Draft'}
                    </Badge>
                  </div>
                  <p className="text-gray-600 mb-3">
                    {article.meta_description || 'No meta description available'}
                  </p>
                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                    <span className="flex items-center">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      {format(new Date(article.created_at), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center">
                      <Type className="w-4 h-4 mr-1" />
                      {article.content ? Math.round(article.content.split(' ').length) : 0} words
                    </span>
                    <span className="flex items-center">
                      <Eye className="w-4 h-4 mr-1" />
                      Topic: {article.topic}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4 lg:mt-0 lg:ml-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewArticle(article)}
                    className="text-gray-600 hover:bg-gray-50"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditArticle(article)}
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyArticle(article)}
                    className="text-green-600 hover:bg-green-50"
                    data-testid={`button-copy-${article.id}`}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadZip(article)}
                    className="text-purple-600 hover:bg-purple-50"
                    disabled={downloadingArticleId === article.id}
                    data-testid={`button-download-${article.id}`}
                  >
                    {downloadingArticleId === article.id ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full mr-1" />
                        ZIP
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" />
                        ZIP
                      </>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-50">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(article.id, 'draft')}
                        className={article.status === 'draft' ? 'bg-yellow-50 text-yellow-800' : ''}
                      >
                        Mark as Draft
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(article.id, 'scheduled')}
                        className={article.status === 'scheduled' ? 'bg-green-50 text-green-800' : ''}
                      >
                        Mark as Approved
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(article.id, 'published')}
                        className={article.status === 'published' ? 'bg-purple-50 text-purple-800' : ''}
                      >
                        Mark as Published
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Schedule Publication Section - Only show for draft and scheduled articles */}
              {(article.status === 'draft' || article.status === 'scheduled') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">Schedule Publication</h3>
                        <p className="text-xs text-gray-500">
                          {article.scheduled_date 
                            ? `Scheduled for ${format(new Date(article.scheduled_date), 'PPP')}` 
                            : 'Set a publish date for this article'}
                        </p>
                      </div>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-start text-left font-normal",
                            !article.scheduled_date && "text-muted-foreground"
                          )}
                          data-testid={`button-schedule-${article.id}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {article.scheduled_date ? format(new Date(article.scheduled_date), "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="end" sideOffset={5}>
                        <Calendar
                          mode="single"
                          selected={article.scheduled_date ? new Date(article.scheduled_date) : undefined}
                          onSelect={async (date) => {
                            if (date) {
                              try {
                                const response = await fetch(`/api/articles/${article.id}/schedule`, {
                                  method: 'PATCH',
                                  credentials: 'include',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${session?.access_token}`,
                                  },
                                  body: JSON.stringify({ scheduled_date: date.toISOString() }),
                                });
                                
                                if (!response.ok) {
                                  throw new Error('Failed to update schedule');
                                }
                                
                                await Promise.all([fetchArticles(), fetchStats()]);
                                
                                toast({
                                  title: "Schedule Updated",
                                  description: `Article scheduled for ${format(date, 'PPP')}`,
                                });
                              } catch (error) {
                                console.error('Error updating schedule:', error);
                                toast({
                                  title: "Error",
                                  description: "Failed to update schedule",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredArticles.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" disabled>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" className="bg-blue-600 text-white">1</Button>
            <Button variant="ghost" size="sm" disabled>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
