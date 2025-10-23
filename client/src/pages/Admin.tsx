import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, GitBranch, Mail, Shield, Eye, Edit, Globe, Key, Trash2, RefreshCw, Copy, ChevronDown, ChevronUp } from "lucide-react";
import type { Client, User } from "@shared/schema";

type Site = {
  id: string;
  name: string;
  domain: string | null;
  storage_bucket_name: string;
  created_at: string;
};

type SiteWithKey = Site & {
  api_key: string;
};

export default function Admin() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"client_editor" | "client_viewer" | "admin">("client_editor");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [rotatedApiKey, setRotatedApiKey] = useState<SiteWithKey | null>(null);
  const [expandedClient, setExpandedClient] = useState<number | null>(null);

  // Fetch all clients
  const { data: clients = [], isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
    enabled: true,
  });

  // Fetch users for selected client
  const { data: clientUsers = [] } = useQuery<User[]>({
    queryKey: selectedClient ? [`/api/admin/clients/${selectedClient.id}/users`] : [],
    enabled: !!selectedClient,
  });

  // Fetch site for expanded client
  const { data: clientSite } = useQuery<Site>({
    queryKey: expandedClient ? [`/api/admin/clients/${expandedClient}/site`] : [],
    enabled: !!expandedClient,
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/admin/clients", { name });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Client Created",
        description: `${data.client.name} workspace created with dedicated site, GitHub repository, and storage bucket`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      setIsCreateDialogOpen(false);
      setNewClientName("");
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating Client",
        description: error.message || "Failed to create client workspace",
        variant: "destructive",
      });
    },
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async ({ clientId, email, role }: { clientId: number; email: string; role: string }) => {
      const response = await apiRequest("POST", `/api/admin/clients/${clientId}/invite`, { email, role });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "User Invited",
        description: data.message,
      });
      if (selectedClient) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/clients/${selectedClient.id}/users`] });
      }
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("client_editor");
    },
    onError: (error: any) => {
      toast({
        title: "Error Inviting User",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Removed",
        description: "User has been removed from the workspace",
      });
      if (selectedClient) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/clients/${selectedClient.id}/users`] });
      }
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error Removing User",
        description: error.message || "Failed to remove user",
        variant: "destructive",
      });
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Role Updated",
        description: data.message,
      });
      if (selectedClient) {
        queryClient.invalidateQueries({ queryKey: [`/api/admin/clients/${selectedClient.id}/users`] });
      }
      setUserToChangeRole(null);
      setNewRole("");
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Role",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  // Rotate API key mutation
  const rotateKeyMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const response = await apiRequest("POST", `/api/admin/sites/${siteId}/rotate-key`);
      return await response.json();
    },
    onSuccess: (data) => {
      setRotatedApiKey(data);
      toast({
        title: "API Key Rotated",
        description: "Save your new API key - it won't be shown again!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Rotating Key",
        description: error.message || "Failed to rotate API key",
        variant: "destructive",
      });
    },
  });

  const handleCreateClient = () => {
    if (newClientName.trim()) {
      createClientMutation.mutate(newClientName.trim());
    }
  };

  const handleInviteUser = () => {
    if (selectedClient && inviteEmail.trim()) {
      inviteUserMutation.mutate({
        clientId: selectedClient.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
    }
  };

  const handleDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleChangeRole = () => {
    if (userToChangeRole && newRole) {
      changeRoleMutation.mutate({
        userId: userToChangeRole.id,
        role: newRole,
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "client_editor":
        return <Edit className="h-4 w-4" />;
      case "client_viewer":
        return <Eye className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "client_editor":
        return "bg-blue-100 text-blue-800";
      case "client_viewer":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loadingClients) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-2">Manage client workspaces, sites, and team members</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="button-add-client">
              <Plus className="mr-2 h-5 w-5" />
              Add New Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Client Workspace</DialogTitle>
              <DialogDescription>
                This will create a new client workspace with a dedicated site, private GitHub repository, and secure storage bucket.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="client-name">Client Name</Label>
                <Input
                  id="client-name"
                  data-testid="input-client-name"
                  placeholder="Enter client name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Repository: {newClientName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}-blog-content
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={!newClientName.trim() || createClientMutation.isPending}
                data-testid="button-confirm-create"
              >
                {createClientMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rotated API Key Alert */}
      {rotatedApiKey && (
        <Alert className="mb-6 border-green-500 bg-green-50" data-testid="alert-rotated-api-key">
          <Key className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">🎉 API Key Rotated! Save it now:</p>
              <div className="flex items-center gap-2 bg-white p-3 rounded border">
                <code className="flex-1 text-sm font-mono break-all" data-testid="text-rotated-api-key">
                  {rotatedApiKey.api_key}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(rotatedApiKey.api_key, "API key")}
                  data-testid="button-copy-rotated-key"
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
                onClick={() => setRotatedApiKey(null)}
                data-testid="button-dismiss-rotated-key"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Client Workspaces</h3>
              <p className="text-muted-foreground text-center mb-4">
                Get started by creating your first client workspace
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                Create First Client
              </Button>
            </CardContent>
          </Card>
        ) : (
          clients.map((client) => {
            const isExpanded = expandedClient === client.id;
            const site = isExpanded ? clientSite : null;
            
            return (
              <Card key={client.id} data-testid={`card-client-${client.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{client.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Workspace ID: {client.slug}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Dialog open={isInviteDialogOpen && selectedClient?.id === client.id} onOpenChange={(open) => {
                        setIsInviteDialogOpen(open);
                        if (open) setSelectedClient(client);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-invite-${client.id}`}>
                            <Mail className="mr-2 h-4 w-4" />
                            Invite User
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invite User to {client.name}</DialogTitle>
                            <DialogDescription>
                              Send an invitation to join this client workspace.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="invite-email">Email Address</Label>
                              <Input
                                id="invite-email"
                                type="email"
                                data-testid="input-invite-email"
                                placeholder="user@example.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="invite-role">Role</Label>
                              <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                                <SelectTrigger id="invite-role" data-testid="select-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">
                                    <div className="flex items-center">
                                      <Shield className="mr-2 h-4 w-4" />
                                      Admin - Full access
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="client_editor">
                                    <div className="flex items-center">
                                      <Edit className="mr-2 h-4 w-4" />
                                      Editor - Can create and edit
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="client_viewer">
                                    <div className="flex items-center">
                                      <Eye className="mr-2 h-4 w-4" />
                                      Viewer - Read-only
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsInviteDialogOpen(false)}
                              data-testid="button-cancel-invite"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleInviteUser}
                              disabled={!inviteEmail.trim() || inviteUserMutation.isPending}
                              data-testid="button-confirm-invite"
                            >
                              {inviteUserMutation.isPending ? (
                                <>
                                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                                  Inviting...
                                </>
                              ) : (
                                "Send Invitation"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newExpanded = isExpanded ? null : client.id;
                          setExpandedClient(newExpanded);
                          if (newExpanded) setSelectedClient(client);
                        }}
                        data-testid={`button-toggle-details-${client.id}`}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent>
                    <div className="space-y-6">
                      {/* Repository Info */}
                      {client.repo_url && (
                        <div className="flex items-center gap-2 text-sm">
                          <GitBranch className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Repository:</span>
                          <a
                            href={client.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                            data-testid={`link-repo-${client.id}`}
                          >
                            {client.repo_url.replace("https://github.com/", "")}
                          </a>
                        </div>
                      )}

                      {/* Site Information */}
                      {site && (
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              CMS Site
                            </h4>
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
                                data-testid={`button-copy-site-id-${site.id}`}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Domain:</span>
                              <span>{site.domain || "Not configured"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Storage Bucket:</span>
                              <code className="bg-muted px-2 py-1 rounded text-xs">
                                {site.storage_bucket_name}
                              </code>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Team Members */}
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3">Team Members</h4>
                        {clientUsers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No team members yet. Invite users to get started.</p>
                        ) : (
                          <div className="space-y-2">
                            {clientUsers.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                data-testid={`user-${user.id}`}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{user.email}</span>
                                      {user.full_name && (
                                        <span className="text-sm text-muted-foreground">({user.full_name})</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                    {getRoleIcon(user.role)}
                                    <span>{user.role.replace("client_", "").replace("_", " ")}</span>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setUserToChangeRole(user);
                                      setNewRole(user.role);
                                    }}
                                    data-testid={`button-change-role-${user.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setUserToDelete(user)}
                                    data-testid={`button-delete-user-${user.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Delete User Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToDelete?.email} from this workspace? This action can be undone by inviting them again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog open={!!userToChangeRole} onOpenChange={() => setUserToChangeRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {userToChangeRole?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-role">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role" data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin - Full access
                    </div>
                  </SelectItem>
                  <SelectItem value="client_editor">
                    <div className="flex items-center">
                      <Edit className="mr-2 h-4 w-4" />
                      Editor - Can create and edit
                    </div>
                  </SelectItem>
                  <SelectItem value="client_viewer">
                    <div className="flex items-center">
                      <Eye className="mr-2 h-4 w-4" />
                      Viewer - Read-only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserToChangeRole(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={!newRole || changeRoleMutation.isPending}
              data-testid="button-confirm-role-change"
            >
              {changeRoleMutation.isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Updating...
                </>
              ) : (
                "Update Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
