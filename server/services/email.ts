import fetch from 'node-fetch';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'bloggen.pro';
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || `BlogGen <noreply@${MAILGUN_DOMAIN}>`;
const APP_URL = process.env.APP_URL || 'https://bloggen.pro';

export class EmailService {
  private apiKey: string;
  private domain: string;

  constructor() {
    this.apiKey = MAILGUN_API_KEY;
    this.domain = MAILGUN_DOMAIN;
  }

  /**
   * Send an invitation email to a new user
   */
  async sendInvitationEmail(
    recipientEmail: string,
    recipientName: string,
    clientName: string,
    role: string,
    inviterName: string = 'BlogGen Admin'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.apiKey) {
        throw new Error('Mailgun API key not configured');
      }

      const roleDisplayName = role.replace('client_', '').replace('_', ' ');
      
      const subject = `Invitation to join ${clientName} on BlogGen`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>BlogGen Invitation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BlogGen</h1>
            <p>AI-Powered Content Publishing Platform</p>
          </div>
          <div class="content">
            <h2>You've been invited to join ${clientName}!</h2>
            
            <p>Hello ${recipientName},</p>
            
            <p>${inviterName} has invited you to join <strong>${clientName}</strong> on BlogGen as a <strong>${roleDisplayName}</strong>.</p>
            
            <p><strong>What is BlogGen?</strong><br>
            BlogGen is an AI-powered content publishing platform that helps teams create, manage, and publish high-quality blog articles with AI assistance.</p>
            
            <p><strong>Your Role: ${roleDisplayName}</strong></p>
            ${role === 'client_editor' 
              ? '<p>As an Editor, you can create new articles, edit existing content, schedule posts, and manage your client\'s blog content.</p>'
              : '<p>As a Viewer, you have read-only access to your client\'s blog content and can review articles and analytics.</p>'
            }
            
            <p><strong>Getting Started:</strong></p>
            <ol>
              <li>Click the button below to access BlogGen</li>
              <li>Sign in using this email address: <strong>${recipientEmail}</strong></li>
              <li>Use the credentials provided by your administrator to complete sign in</li>
              <li>You'll automatically be assigned to the ${clientName} workspace</li>
            </ol>
            
            <div style="text-align: center;">
              <a href="${APP_URL}/auth" class="button">
                Access BlogGen
              </a>
            </div>
            
            <p><strong>Need Help?</strong><br>
            If you have any questions or need assistance getting started, please don't hesitate to reach out to your team administrator.</p>
            
            <p>Welcome to the team!</p>
            
            <div class="footer">
              <p>This invitation was sent by ${inviterName} for ${clientName}.<br>
              If you weren't expecting this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
        BlogGen Invitation
        
        Hello ${recipientName},
        
        ${inviterName} has invited you to join ${clientName} on BlogGen as a ${roleDisplayName}.
        
        What is BlogGen?
        BlogGen is an AI-powered content publishing platform that helps teams create, manage, and publish high-quality blog articles with AI assistance.
        
        Your Role: ${roleDisplayName}
        ${role === 'client_editor' 
          ? 'As an Editor, you can create new articles, edit existing content, schedule posts, and manage your client\'s blog content.'
          : 'As a Viewer, you have read-only access to your client\'s blog content and can review articles and analytics.'
        }
        
        Getting Started:
        1. Visit: ${APP_URL}/auth
        2. Sign in using this email address: ${recipientEmail}
        3. Use the credentials provided by your administrator to complete sign in
        4. You'll automatically be assigned to the ${clientName} workspace
        
        Need Help?
        If you have any questions or need assistance getting started, please don't hesitate to reach out to your team administrator.
        
        Welcome to the team!
        
        ---
        This invitation was sent by ${inviterName} for ${clientName}.
        If you weren't expecting this invitation, you can safely ignore this email.
      `;

      const formData = new URLSearchParams();
      formData.append('from', FROM_EMAIL);
      formData.append('to', `${recipientName} <${recipientEmail}>`);
      formData.append('subject', subject);
      formData.append('text', textContent);
      formData.append('html', htmlContent);

      const response = await fetch(
        `https://api.mailgun.net/v3/${this.domain}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Email sent successfully:', result);

      return { success: true };
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error' 
      };
    }
  }

  /**
   * Send a test email
   */
  async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      const formData = new URLSearchParams();
      formData.append('from', FROM_EMAIL);
      formData.append('to', recipientEmail);
      formData.append('subject', 'BlogGen Test Email');
      formData.append('text', 'This is a test email from BlogGen to verify email functionality is working correctly!');

      const response = await fetch(
        `https://api.mailgun.net/v3/${this.domain}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to send test email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error' 
      };
    }
  }
}

export const emailService = new EmailService();
