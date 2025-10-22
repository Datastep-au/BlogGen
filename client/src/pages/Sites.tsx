import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Copy, Key, Plus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Site = {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
};

type SiteWithKey = Site & {
  api_key: string;
};

export default function Sites() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteDomain, setNewSiteDomain] = useState("");
  const [createdSite, setCreatedSite] = useState<SiteWithKey | null>(null);

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["/api/admin/sites"],
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: { name: string; domain?: string }) => {
      const response = await apiRequest("POST", "/api/admin/sites", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sites"] });
      setCreatedSite(data);
      setNewSiteName("");
      setNewSiteDomain("");
      toast({
        title: "Site created!",
        description: "Save your API key - it won't be shown again!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const response = await apiRequest("POST", `/api/admin/sites/${siteId}/rotate-key`);
      return response.json();
    },
    onSuccess: (data) => {
      setCreatedSite(data);
      toast({
        title: "API key rotated",
        description: "Save your new API key - it won't be shown again!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateSite = () => {
    if (!newSiteName.trim()) {
      toast({
        title: "Error",
        description: "Site name is required",
        variant: "destructive",
      });
      return;
    }

    createSiteMutation.mutate({
      name: newSiteName,
      domain: newSiteDomain.trim() || undefined,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl" data-testid="sites-page">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">CMS Sites</h1>
          <p className="text-muted-foreground mt-1">
            Manage your headless CMS sites and API keys
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-site">
              <Plus className="w-4 h-4 mr-2" />
              Create Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Site</DialogTitle>
              <DialogDescription>
                Create a new CMS site to get an API key for content delivery
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="site-name">Site Name *</Label>
                <Input
                  id="site-name"
                  data-testid="input-site-name"
                  placeholder="My Blog"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="site-domain">Domain (optional)</Label>
                <Input
                  id="site-domain"
                  data-testid="input-site-domain"
                  placeholder="myblog.com"
                  value={newSiteDomain}
                  onChange={(e) => setNewSiteDomain(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateSite}
                disabled={createSiteMutation.isPending}
                className="w-full"
                data-testid="button-submit-create"
              >
                {createSiteMutation.isPending ? "Creating..." : "Create Site"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {createdSite && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950" data-testid="alert-api-key">
          <Key className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">
                🎉 Site created successfully! Save your API key:
              </p>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-3 rounded border">
                <code className="flex-1 text-sm font-mono break-all" data-testid="text-api-key">
                  {createdSite.api_key}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdSite.api_key, "API key")}
                  data-testid="button-copy-api-key"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ This key won't be shown again. Store it securely!
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreatedSite(null)}
                data-testid="button-dismiss-alert"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-8" data-testid="loading-sites">Loading sites...</div>
      ) : sites.length === 0 ? (
        <Card data-testid="empty-state">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No sites yet. Create your first site to get started!
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-site">
                <Plus className="w-4 h-4 mr-2" />
                Create First Site
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4" data-testid="sites-grid">
          {sites.map((site) => (
            <Card key={site.id} data-testid={`card-site-${site.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle data-testid={`text-site-name-${site.id}`}>{site.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {site.domain || "No domain configured"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rotateKeyMutation.mutate(site.id)}
                    disabled={rotateKeyMutation.isPending}
                    data-testid={`button-rotate-key-${site.id}`}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rotate API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Site ID:</span>
                    <code className="bg-muted px-2 py-1 rounded" data-testid={`text-site-id-${site.id}`}>
                      {site.id}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(site.id, "Site ID")}
                      data-testid={`button-copy-id-${site.id}`}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {new Date(site.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">1. Create a Site</h3>
            <p className="text-muted-foreground">
              Click "Create Site" above to generate a new site and receive your API key.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">2. Authenticate</h3>
            <p className="text-muted-foreground">
              Use your API key to get a JWT token:
            </p>
            <code className="block bg-muted p-2 rounded mt-1">
              POST /api/auth/token {`{ "api_key": "sk_live_..." }`}
            </code>
          </div>
          <div>
            <h3 className="font-semibold mb-2">3. Fetch Content</h3>
            <p className="text-muted-foreground">
              Use the JWT to access the CMS API:
            </p>
            <code className="block bg-muted p-2 rounded mt-1">
              GET /v1/sites/{`{site_id}`}/posts
            </code>
          </div>
          <div>
            <p className="text-muted-foreground">
              📖 Full API documentation is available in{" "}
              <code>CMS_API_DOCUMENTATION.md</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
