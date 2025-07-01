/*
  # Test Notion Connection Function

  This Edge Function tests Notion database connections server-side
  to avoid CORS issues when testing from the frontend.
  
  Features:
  - Server-side Notion API testing
  - Proper error handling and validation
  - CORS support for frontend requests
*/

import { corsHeaders } from '../_shared/cors.ts';

interface TestConnectionRequest {
  database_id: string;
  access_token: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { database_id, access_token }: TestConnectionRequest = await req.json();

    // Validate input
    if (!database_id || !access_token) {
      throw new Error('Database ID and access token are required');
    }

    console.log(`Testing Notion connection for database: ${database_id}`);

    // Test the connection to Notion API
    const response = await fetch(`https://api.notion.com/v1/databases/${database_id}`, {
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
        errorMessage = 'Database not found. Make sure the database ID is correct and the integration has access.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Make sure you\'ve shared the database with your integration.';
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

    const database = await response.json();
    const databaseTitle = database.title?.[0]?.plain_text || 'Untitled Database';

    console.log(`Successfully connected to database: ${databaseTitle}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully connected to "${databaseTitle}"`,
        database_title: databaseTitle,
        properties: Object.keys(database.properties || {})
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Test connection error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Failed to test connection',
        error: error.stack
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});