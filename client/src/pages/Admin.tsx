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
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, GitBranch, Mail, Shield, Eye, Edit } from "lucide-react";
import type { Client, User } from "@shared/schema";

export default function Admin() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"client_editor" | "client_viewer">("client_editor");

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

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/admin/clients", { name });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Client Created",
        description: `${data.client.name} workspace has been created with GitHub repository`,
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
          <p className="text-muted-foreground mt-2">Manage client workspaces and user access</p>
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
                This will create a new client workspace and initialize a private GitHub repository for their content.
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
                  Repository will be named: {newClientName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}-blog-content
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
          clients.map((client) => (
            <Card key={client.id} data-testid={`card-client-${client.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{client.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Workspace ID: {client.slug}
                    </CardDescription>
                  </div>
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
                          Send an invitation to a user to join this client workspace.
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
                              <SelectItem value="client_editor">
                                <div className="flex items-center">
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editor - Can create and edit content
                                </div>
                              </SelectItem>
                              <SelectItem value="client_viewer">
                                <div className="flex items-center">
                                  <Eye className="mr-2 h-4 w-4" />
                                  Viewer - Read-only access
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                  
                  {selectedClient?.id === client.id && clientUsers.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Team Members</h4>
                      <div className="space-y-2">
                        {clientUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            data-testid={`user-${user.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{user.email}</span>
                              {user.full_name && (
                                <span className="text-sm text-muted-foreground">({user.full_name})</span>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                              {getRoleIcon(user.role)}
                              <span>{user.role.replace("client_", "").replace("_", " ")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                    className="w-full"
                    data-testid={`button-toggle-users-${client.id}`}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    {selectedClient?.id === client.id ? "Hide" : "Show"} Team Members
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}