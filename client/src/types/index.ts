export interface GenerationRequest {
  topic?: string;
  bulk_topics?: string[];
}

export interface GenerationResponse {
  success: boolean;
  message: string;
  generated_count?: number;
  total_requested?: number;
  errors?: string[];
}

export interface UsageStats {
  count: number;
  limit: number;
}
