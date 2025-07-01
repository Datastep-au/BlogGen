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
  created_at: string;
  updated_at: string;
}

export interface ArticleGeneration {
  topic: string;
  bulk_topics?: string[];
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}