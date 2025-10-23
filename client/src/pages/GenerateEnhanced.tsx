import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Upload, GitBranch, AlertCircle, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client } from '@shared/schema';

export default function GenerateEnhanced() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [topic, setTopic] = useState('');
  const [bulkTopics, setBulkTopics] = useState('');
  const [commitToRepo, setCommitToRepo] = useState(false);
  const [generateImage, setGenerateImage] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');

  // Fetch user profile to get role
  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        setUserRole(data.role);
        if (data.client_id) {
          setSelectedClientId(data.client_id);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch clients (for admins)
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/admin/clients'],
    enabled: userRole === 'admin',
  });

  // Fetch usage statistics
  const { data: usage } = useQuery<{
    count: number;
    limit: number;
    month: string;
  }>({
    queryKey: ['/api/usage'],
  });

  // Generate article mutation
  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/generate-article', data);
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Articles Generated',
          description: data.message,
          action: data.articles?.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/app/dashboard'}
            >
              View Articles
            </Button>
          ) : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/usage'] });
        queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
        
        // Reset form
        setTopic('');
        setBulkTopics('');
        setImagePrompt('');
      } else {
        toast({
          title: 'Generation Failed',
          description: data.message || 'Failed to generate articles',
          variant: 'destructive',
        });
      }

      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error: string) => {
          toast({
            title: 'Warning',
            description: error,
            variant: 'destructive',
          });
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate articles',
        variant: 'destructive',
      });
    },
  });

  const handleGenerate = () => {
    const requestData: any = {
      commit_to_repo: commitToRepo,
      client_id: selectedClientId,
      generate_image: generateImage,
      image_prompt: imagePrompt || undefined,
    };

    if (mode === 'single') {
      if (!topic.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter a topic',
          variant: 'destructive',
        });
        return;
      }
      requestData.topic = topic.trim();
    } else {
      const topics = bulkTopics
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      if (topics.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please enter at least one topic',
          variant: 'destructive',
        });
        return;
      }
      
      if (topics.length > 10) {
        toast({
          title: 'Validation Error',
          description: 'Maximum 10 topics allowed in bulk generation',
          variant: 'destructive',
        });
        return;
      }
      
      requestData.bulk_topics = topics;
    }

    generateMutation.mutate(requestData);
  };

  const remainingArticles = usage ? (usage.limit - usage.count) : 10;
  const canGenerate = remainingArticles > 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate AI-Powered Articles</h1>
        <p className="text-muted-foreground">
          Create SEO-optimized blog articles with AI assistance
        </p>
      </div>

      {/* Usage Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Monthly Usage</span>
            <span className="text-sm font-normal text-muted-foreground">
              Resets on the 1st of each month
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {usage ? `${usage.count} / ${usage.limit}` : '0 / 10'} articles generated
              </span>
            </div>
            {!canGenerate && (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Monthly limit reached</span>
              </div>
            )}
          </div>
          <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                remainingArticles > 3 ? "bg-primary" : remainingArticles > 0 ? "bg-yellow-500" : "bg-destructive"
              )}
              style={{ width: `${usage ? (usage.count / usage.limit) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Article Generation</CardTitle>
          <CardDescription>
            Enter topics and configure generation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Selection (Admin Only) */}
          {userRole === 'admin' && clients.length > 0 && (
            <div className="space-y-2">
              <Label>Client Workspace</Label>
              <Select
                value={selectedClientId?.toString() || ''}
                onValueChange={(value) => setSelectedClientId(value ? parseInt(value) : null)}
              >
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select a client workspace" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mode Selection */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single Article</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Generation</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Article Topic</Label>
                <Input
                  id="topic"
                  data-testid="input-topic"
                  placeholder="e.g., 10 Best Practices for Remote Work"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={generateMutation.isPending}
                />
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-topics">Topics (one per line, max 10)</Label>
                <Textarea
                  id="bulk-topics"
                  data-testid="textarea-bulk-topics"
                  placeholder="Enter each topic on a new line..."
                  className="min-h-[150px]"
                  value={bulkTopics}
                  onChange={(e) => setBulkTopics(e.target.value)}
                  disabled={generateMutation.isPending}
                />
                <p className="text-sm text-muted-foreground">
                  {bulkTopics.split('\n').filter(t => t.trim()).length} topics entered
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Advanced Options */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Advanced Options</h3>

            {/* Image Generation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="generate-image">Generate Hero Image</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-generate a hero image for the article
                  </p>
                </div>
                <Switch
                  id="generate-image"
                  checked={generateImage}
                  onCheckedChange={setGenerateImage}
                  data-testid="switch-generate-image"
                />
              </div>
              
              {generateImage && (
                <div className="space-y-2">
                  <Label htmlFor="image-prompt">Custom Image Prompt (Optional)</Label>
                  <Textarea
                    id="image-prompt"
                    data-testid="textarea-image-prompt"
                    placeholder="Describe the image you want (leave empty for auto-generation based on topic)"
                    className="min-h-[80px]"
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    disabled={generateMutation.isPending}
                  />
                </div>
              )}
            </div>

            {/* Commit to Repository */}
            {selectedClientId && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="commit-repo">Commit to Repository</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically commit to client's GitHub repository
                  </p>
                </div>
                <Switch
                  id="commit-repo"
                  checked={commitToRepo}
                  onCheckedChange={setCommitToRepo}
                  data-testid="switch-commit-repo"
                />
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={!canGenerate || generateMutation.isPending}
            data-testid="button-generate"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate {mode === 'bulk' ? 'Articles' : 'Article'}
              </>
            )}
          </Button>

          {!canGenerate && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Monthly Limit Reached</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've reached your monthly limit of {usage?.limit || 10} articles. 
                    Your limit will reset on the 1st of next month.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}