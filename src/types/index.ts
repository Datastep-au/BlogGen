export interface Article {
  id: string;
  user_id: string;
  topic: string;
  title: string;
  content: string;
  meta_description: string;
  keywords: string[];
  status: 'draft' | 'approved' | 'scheduled' | 'published';
  scheduled_date?: string;
  notion_page_id?: string;
  created_at: string;
  updated_at: string;
}

export interface NotionConnection {
  id: string;
  user_id: string;
  workspace_name: string;
  parent_page_id: string; // For storing article pages
  tracking_database_id: string; // For tracking articles in a database
  access_token: string;
  created_at: string;
}

export interface ArticleGeneration {
  topic: string;
  notion_parent_page_id?: string;
  bulk_topics?: string[];
}

export interface ScheduleJob {
  id: string;
  user_id: string;
  article_id: string;
  scheduled_date: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}