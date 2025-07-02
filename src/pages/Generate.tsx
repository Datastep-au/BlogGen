import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import TopicForm from '../components/TopicForm';
import { useAuth } from '../contexts/AuthContext';

export default function Generate() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } | null>(null);

  const handleTopicSubmit = async (data: { 
    topic?: string; 
    bulk_topics?: string[];
  }) => {
    if (!user) {
      setGenerationStatus({
        success: false,
        message: 'Please sign in to generate articles'
      });
      return;
    }

    setIsGenerating(true);
    setGenerationStatus(null);

    try {
      console.log('Submitting article generation request:', data);
      console.log('Current user:', user);
      
      // Check if Supabase URL and key are available
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing. Please check your environment variables.');
      }

      // Get the current session to ensure we have a valid token
      const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession());
      
      if (!session?.access_token) {
        throw new Error('No valid session found. Please sign out and sign in again.');
      }

      const apiUrl = `${supabaseUrl}/functions/v1/generate-article`;
      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      };

      console.log('Making request to:', apiUrl);
      console.log('Using session token:', session.access_token.substring(0, 20) + '...');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'Unknown error occurred';
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Success response:', result);

      setGenerationStatus({
        success: true,
        message: data.bulk_topics 
          ? `Successfully generated ${result.generated_count} out of ${result.total_requested} articles!`
          : 'Article generated successfully!',
        count: result.generated_count,
        errors: result.errors
      });

    } catch (error) {
      console.error('Error generating article:', error);
      
      let errorMessage = 'Failed to generate article';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to the article generation service. Please check your internet connection and try again.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setGenerationStatus({
        success: false,
        message: errorMessage
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI-Powered SEO Article Generator
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Create professional, SEO-optimized blog articles in seconds. Our AI analyzes your topic and generates comprehensive content with proper structure, keywords, and meta descriptions.
        </p>
      </div>

      {/* Generation Status */}
      {generationStatus && (
        <div className={`rounded-lg p-4 ${
          generationStatus.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start">
            {generationStatus.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                generationStatus.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {generationStatus.message}
              </p>
              {generationStatus.errors && generationStatus.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-yellow-700 font-medium">Partial failures:</p>
                  <ul className="text-sm text-yellow-600 mt-1 list-disc list-inside">
                    {generationStatus.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {generationStatus.success && (
                <p className="text-sm text-green-600 mt-1">
                  Check the Dashboard to view and manage your generated articles.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <TopicForm onSubmit={handleTopicSubmit} isLoading={isGenerating} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">What Our AI Does</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">SEO-Optimized Titles</h4>
                <p className="text-sm text-gray-600">Creates catchy, search-engine friendly titles</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">Meta Descriptions</h4>
                <p className="text-sm text-gray-600">Generates compelling meta descriptions for better CTR</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">Keyword Integration</h4>
                <p className="text-sm text-gray-600">Naturally incorporates relevant keywords throughout</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">Structured Content</h4>
                <p className="text-sm text-gray-600">Proper H2/H3 headings for better readability</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">Professional Tone</h4>
                <p className="text-sm text-gray-600">Maintains a friendly yet professional writing style</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-gray-900">Easy Editing</h4>
                <p className="text-sm text-gray-600">Edit and refine your articles with our built-in editor</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}