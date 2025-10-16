import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import TopicForm from '@/components/TopicForm';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Generate() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [monthlyUsage, setMonthlyUsage] = useState({ count: 0, limit: 10 });
  const [generationStatus, setGenerationStatus] = useState<{
    success: boolean;
    message: string;
    count?: number;
    errors?: string[];
  } | null>(null);

  useEffect(() => {
    if (user) {
      checkMonthlyUsage();
    }
  }, [user]);

  const checkMonthlyUsage = async () => {
    if (!user) return;

    try {
      // Get current month's articles
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('articles')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (error) throw error;

      setMonthlyUsage({
        count: data?.length || 0,
        limit: 10
      });
    } catch (error) {
      console.error('Error checking monthly usage:', error);
    }
  };

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

    // Check if user has reached monthly limit
    const topicsToGenerate = data.bulk_topics?.length || 1;
    if (monthlyUsage.count + topicsToGenerate > monthlyUsage.limit) {
      setGenerationStatus({
        success: false,
        message: `Monthly limit exceeded. You can generate ${monthlyUsage.limit - monthlyUsage.count} more articles this month. Your limit resets on the 1st of each month.`
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No valid session found. Please sign out and sign in again.');
      }

      console.log('Using session token for user:', session.user?.email);

      const apiUrl = `${supabaseUrl}/functions/v1/generate-article`;
      const headers = {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
      };

      console.log('Making request to:', apiUrl);

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

      // Refresh monthly usage
      await checkMonthlyUsage();

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

  const remainingArticles = monthlyUsage.limit - monthlyUsage.count;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <img 
            src="/BlogGen_Pro_Logo.png" 
            alt="BlogGen Pro" 
            className="w-28 h-28"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          AI-Powered SEO Article Generator
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
          Create professional, SEO-optimized blog articles in seconds. Our AI analyzes your topic and generates comprehensive content with proper structure, keywords, and meta descriptions.
        </p>
      </div>

      {/* Monthly Usage Display */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Monthly Usage</h3>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            remainingArticles > 5 ? 'bg-green-100 text-green-800' :
            remainingArticles > 2 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {remainingArticles} remaining
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(monthlyUsage.count / monthlyUsage.limit) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-600">
          {monthlyUsage.count} of {monthlyUsage.limit} articles used this month
        </p>
        {remainingArticles <= 2 && remainingArticles > 0 && (
          <p className="text-sm text-yellow-600 mt-2">
            ⚠️ You're approaching your monthly limit. Your usage resets on the 1st of each month.
          </p>
        )}
        {remainingArticles === 0 && (
          <p className="text-sm text-red-600 mt-2">
            🚫 You've reached your monthly limit. Your usage will reset on the 1st of next month.
          </p>
        )}
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
        <TopicForm
          onSubmit={handleTopicSubmit}
          isLoading={isGenerating}
          remainingArticles={remainingArticles}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
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
