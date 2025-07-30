export class EmailTemplates {
  static welcomeWithPassword(
    firstName: string,
    email: string,
    password: string,
    companyName?: string,
    roles?: string[],
    dashboardUrl?: string,
    colors?: {
      primary: string;
      secondary: string;
    },
    appName?: string,
  ): string {
    const companySection = companyName
      ? `<p>Has sido registrado en <strong>${companyName}</strong>.</p>`
      : '';

    const rolesSection = roles && roles.length > 0
      ? `<p><strong>Roles asignados:</strong> ${roles.join(', ')}</p>`
      : '';

    const primaryColor = colors?.primary || '#007bff';
    const secondaryColor = colors?.secondary || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Bienvenido a la plataforma</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .content {
              background-color: #fff;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .credentials {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #${primaryColor};
            }
            .password {
              font-family: 'Courier New', monospace;
              font-size: 16px;
              font-weight: bold;
              color: #${primaryColor};
            }
            .warning {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>¡Bienvenido!</h1>
          </div>
          
          <div class="content">
            <h2>Hola ${firstName},</h2>
            
            <p>Te damos la bienvenida a ${appName || 'nuestra plataforma'}. Tu cuenta ha sido creada exitosamente.</p>
            
            ${companySection}
            
            <div class="credentials">
              <h3>Tus credenciales de acceso:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Contraseña temporal:</strong> <span class="password">${password}</span></p>
              ${rolesSection}
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong>
              <ul>
                <li>Esta es una contraseña temporal generada automáticamente</li>
                <li>Te recomendamos cambiarla después de tu primer inicio de sesión</li>
                <li>Mantén esta información segura y no la compartas con nadie</li>
              </ul>
            </div>
            
            <p>Para acceder a la plataforma, haz clic en el siguiente enlace:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${dashboardUrl || '#'}"
                  style="background-color: #${primaryColor}; color: white; padding: 12px 25px;
                  text-decoration: none; border-radius: 4px; font-weight: bold;">
                Acceder a la Plataforma
              </a>
            </div>
            
            <p>Saludos cordiales,<br>El equipo de desarrollo</p>
          </div>
          
          <div class="footer">
            <p>Este email fue enviado automáticamente. Por favor no respondas a este mensaje.</p>
          </div>
        </body>
      </html>
    `;
  }
}
