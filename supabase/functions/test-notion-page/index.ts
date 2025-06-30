/*
  # Test Notion Page Connection Function

  This Edge Function tests Notion page connections server-side
  to avoid CORS issues when testing from the frontend.
  
  Features:
  - Server-side Notion API testing for pages
  - Proper error handling and validation
  - CORS support for frontend requests
*/

import { corsHeaders } from '../_shared/cors.ts';

interface TestPageRequest {
  page_id: string;
  access_token: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page_id, access_token }: TestPageRequest = await req.json();

    // Validate input
    if (!page_id || !access_token) {
      throw new Error('Page ID and access token are required');
    }

    console.log(`Testing Notion connection for page: ${page_id}`);

    // Test the connection to Notion API
    const response = await fetch(`https://api.notion.com/v1/pages/${page_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      let errorMessage = 'Connection failed';
      
      if (response.status === 401) {
        errorMessage = 'Invalid access token. Please check your integration token.';
      } else if (response.status === 404) {
        errorMessage = 'Page not found. Make sure the page ID is correct and the integration has access.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Make sure you\'ve shared the page with your integration.';
      } else {
        errorMessage = error.message || `HTTP ${response.status}: ${response.statusText}`;
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage,
          status: response.status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const page = await response.json();
    const pageTitle = page.properties?.title?.title?.[0]?.plain_text || 
                     page.properties?.Name?.title?.[0]?.plain_text ||
                     'Untitled Page';

    console.log(`Successfully connected to page: ${pageTitle}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully connected to "${pageTitle}"`,
        page_title: pageTitle,
        page_id: page.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Test page connection error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Failed to test page connection',
        error: error.stack
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});