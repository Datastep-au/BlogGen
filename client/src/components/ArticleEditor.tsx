import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, X } from 'lucide-react';
import type { Article } from '@shared/schema';

interface ArticleEditorProps {
  article: Article;
  onSave: (article: Partial<Article>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ArticleEditor({ article, onSave, onCancel, isLoading = false }: ArticleEditorProps) {
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [metaDescription, setMetaDescription] = useState(article.meta_description || '');
  const [keywords, setKeywords] = useState<string[]>(article.keywords || []);
  const [newKeyword, setNewKeyword] = useState('');

  const handleSave = () => {
    onSave({
      id: article.id,
      title,
      content,
      meta_description: metaDescription,
      keywords,
    });
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit Article</h1>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <Label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Article Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title"
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="meta-description" className="block text-sm font-medium text-gray-700 mb-2">
            Meta Description
          </Label>
          <Textarea
            id="meta-description"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Enter meta description for SEO"
            rows={3}
            disabled={isLoading}
          />
          <p className="text-sm text-gray-500 mt-1">
            {metaDescription.length}/160 characters (recommended length for SEO)
          </p>
        </div>

        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-2">
            Keywords
          </Label>
          <div className="flex items-center space-x-2 mb-3">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={handleKeywordKeyPress}
              placeholder="Add keyword"
              disabled={isLoading}
            />
            <Button 
              type="button" 
              onClick={addKeyword}
              disabled={!newKeyword.trim() || isLoading}
              variant="outline"
              size="sm"
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  disabled={isLoading}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
            Article Content
          </Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter article content"
            rows={20}
            disabled={isLoading}
            className="font-mono text-sm"
          />
          <p className="text-sm text-gray-500 mt-1">
            Word count: {content.split(/\s+/).filter(word => word.length > 0).length}
          </p>
        </div>
      </div>
    </div>
  );
}
