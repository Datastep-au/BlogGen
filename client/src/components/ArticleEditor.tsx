import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, X, RefreshCw, Image as ImageIcon, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Article } from '@shared/schema';

interface ArticleEditorProps {
  article: Article;
  onSave: (article: Partial<Article>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  accessToken?: string;
}

export default function ArticleEditor({ article, onSave, onCancel, isLoading = false, accessToken }: ArticleEditorProps) {
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const [metaDescription, setMetaDescription] = useState(article.meta_description || '');
  const [keywords, setKeywords] = useState<string[]>(article.keywords || []);
  const [newKeyword, setNewKeyword] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [isEditingWithAI, setIsEditingWithAI] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState(article.hero_image_url || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSave = () => {
    onSave({
      id: article.id,
      title,
      content,
      meta_description: metaDescription,
      keywords,
      hero_image_url: heroImageUrl,
    });
  };

  const handleEditWithAI = async () => {
    if (!editInstructions.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter instructions for the AI',
        variant: 'destructive',
      });
      return;
    }

    if (!accessToken) {
      toast({
        title: 'Error',
        description: 'Authentication required',
        variant: 'destructive',
      });
      return;
    }

    setIsEditingWithAI(true);
    try {
      const response = await fetch(`/api/articles/${article.id}/edit-with-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          instructions: editInstructions,
          currentContent: {
            title,
            content,
            meta_description: metaDescription,
            keywords,
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit article with AI');
      }

      const data = await response.json();
      
      if (data.success && data.article) {
        setTitle(data.article.title);
        setContent(data.article.content);
        setMetaDescription(data.article.meta_description);
        setKeywords(data.article.keywords);
        
        toast({
          title: 'Success',
          description: 'Article updated based on your instructions',
        });
        setEditInstructions('');
      }
    } catch (error) {
      console.error('Error editing with AI:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to edit with AI',
        variant: 'destructive',
      });
    } finally {
      setIsEditingWithAI(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an image prompt',
        variant: 'destructive',
      });
      return;
    }

    if (!accessToken) {
      toast({
        title: 'Error',
        description: 'Authentication required',
        variant: 'destructive',
      });
      return;
    }

    setIsRegeneratingImage(true);
    try {
      const response = await fetch(`/api/articles/${article.id}/regenerate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ prompt: imagePrompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate image');
      }

      const data = await response.json();
      const regeneratedUrl =
        data.hero_image_url ??
        data.featured_image ??
        data.article?.hero_image_url ??
        data.article?.featured_image ??
        null;

      if (regeneratedUrl) {
        setHeroImageUrl(regeneratedUrl);
        toast({
          title: 'Success',
          description: 'Hero image regenerated successfully',
        });
      } else {
        toast({
          title: 'Warning',
          description: 'Image was generated but the URL was missing from the response.',
        });
      }
      setImagePrompt('');
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to regenerate image',
        variant: 'destructive',
      });
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    if (!accessToken) {
      toast({
        title: 'Error',
        description: 'Authentication required',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/articles/${article.id}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await response.json();
      const uploadedUrl = data.hero_image_url;

      if (uploadedUrl) {
        setHeroImageUrl(uploadedUrl);
        toast({
          title: 'Success',
          description: 'Image uploaded successfully',
        });
      } else {
        toast({
          title: 'Warning',
          description: 'Image was uploaded but the URL was missing from the response.',
        });
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
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
        {/* AI Edit Section */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-800 font-medium">
            <RefreshCw className="w-4 h-4" />
            <span>Edit with AI</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-instructions" className="text-sm text-blue-700">
              Instructions for AI Editor
            </Label>
            <div className="flex gap-2">
              <Textarea
                id="ai-instructions"
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder="e.g., 'Make the tone more professional', 'Add a section about benefits', 'Fix grammar and flow'"
                className="min-h-[80px] bg-white"
                disabled={isEditingWithAI || isLoading}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleEditWithAI}
                disabled={!editInstructions.trim() || isEditingWithAI || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isEditingWithAI ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

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
            Featured Image
          </Label>
          <div className="border rounded-lg p-4 space-y-4">
            {heroImageUrl && (
              <div className="relative">
                <img
                  src={heroImageUrl}
                  alt={title}
                  className="w-full max-w-2xl rounded-lg"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/800x400?text=Image+Not+Found';
                  }}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label className="block text-sm font-medium text-gray-700">
                Upload Your Own Image
              </Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
                <Button
                  type="button"
                  onClick={handleUploadButtonClick}
                  disabled={isUploadingImage || isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  {isUploadingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Upload your own image (max 10MB, JPG, PNG, or WebP)
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or generate with AI</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="image-prompt" className="block text-sm font-medium text-gray-700">
                {heroImageUrl ? 'Regenerate with custom prompt' : 'Generate hero image with custom prompt'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="image-prompt"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the new image you want..."
                  disabled={isRegeneratingImage || isLoading}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && imagePrompt.trim()) {
                      e.preventDefault();
                      handleRegenerateImage();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={handleRegenerateImage}
                  disabled={!imagePrompt.trim() || isRegeneratingImage || isLoading}
                  variant="outline"
                >
                  {isRegeneratingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      {heroImageUrl ? 'Regenerate' : 'Generate'}
                    </>
                  )}
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Enter a custom prompt to generate a new hero image for this article
              </p>
            </div>
          </div>
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
