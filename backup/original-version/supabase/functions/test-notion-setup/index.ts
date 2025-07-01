/*
  # Test Notion Setup Function

  This Edge Function tests both Notion page and database connections
  to ensure the complete setup is working properly.
  
  Features:
  - Tests page connection for article storage
  - Tests database connection for article tracking
  - Validates database schema
  - Proper error handling and validation
  - CORS support for frontend requests
*/

import { corsHeaders } from '../_shared/cors.ts';

interface TestSetupRequest {
  page_id: string;
  database_id: string;
  access_token: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page_id, database_id, access_token }: TestSetupRequest = await req.json();

    // Validate input
    if (!page_id || !database_id || !access_token) {
      throw new Error('Page ID, database ID, and access token are required');
    }

    console.log(`Testing Notion setup - Page: ${page_id}, Database: ${database_id}`);

    // Test page connection
    const pageResult = await testPageConnection(page_id, access_token);
    if (!pageResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Page connection failed: ${pageResult.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Test database connection
    const databaseResult = await testDatabaseConnection(database_id, access_token);
    if (!databaseResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Database connection failed: ${databaseResult.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Both connections successful');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Both page and database connections successful',
        page_title: pageResult.title,
        database_title: databaseResult.title
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Test setup error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Failed to test setup',
        error: error.stack
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function testPageConnection(pageId: string, accessToken: string) {
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      let errorMessage = 'Page connection failed';
      
      if (response.status === 401) {
        errorMessage = 'Invalid access token for page';
      } else if (response.status === 404) {
        errorMessage = 'Page not found or integration lacks access';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Share the page with your integration';
      } else {
        errorMessage = error.message || `HTTP ${response.status}`;
      }

      return { success: false, message: errorMessage };
    }

    const page = await response.json();
    const pageTitle = page.properties?.title?.title?.[0]?.plain_text || 
                     page.properties?.Name?.title?.[0]?.plain_text ||
                     'Untitled Page';

    return { success: true, title: pageTitle };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function testDatabaseConnection(databaseId: string, accessToken: string) {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      let errorMessage = 'Database connection failed';
      
      if (response.status === 401) {
        errorMessage = 'Invalid access token for database';
      } else if (response.status === 404) {
        errorMessage = 'Database not found or integration lacks access';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Share the database with your integration';
      } else {
        errorMessage = error.message || `HTTP ${response.status}`;
      }

      return { success: false, message: errorMessage };
    }

    const database = await response.json();
    const databaseTitle = database.title?.[0]?.plain_text || 'Untitled Database';
    
    // Validate required properties
    const properties = database.properties || {};
    const requiredProperties = ['Article Name', 'Topic', 'Status', 'Creation Date', 'Publish Date'];
    const missingProperties = requiredProperties.filter(prop => !properties[prop]);
    
    if (missingProperties.length > 0) {
      return {
        success: false,
        message: `Database missing required columns: ${missingProperties.join(', ')}`
      };
    }

    // Validate Status property has correct options
    const statusProperty = properties['Status'];
    if (statusProperty?.type !== 'select') {
      return {
        success: false,
        message: 'Status column must be a Select property'
      };
    }

    return { success: true, title: databaseTitle };
  } catch (error) {
    return { success: false, message: error.message };
  }
}