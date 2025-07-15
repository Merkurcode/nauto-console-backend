export class EmailTemplates {
  static welcomeWithPassword(
    firstName: string,
    email: string,
    password: string,
    companyName?: string,
  ): string {
    const companySection = companyName
      ? `<p>Has sido registrado en <strong>${companyName}</strong>.</p>`
      : '';

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
              border-left: 4px solid #007bff;
            }
            .password {
              font-family: 'Courier New', monospace;
              font-size: 16px;
              font-weight: bold;
              color: #007bff;
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
            
            <p>Te damos la bienvenida a nuestra plataforma. Tu cuenta ha sido creada exitosamente.</p>
            
            ${companySection}
            
            <div class="credentials">
              <h3>Tus credenciales de acceso:</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Contraseña temporal:</strong> <span class="password">${password}</span></p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Importante:</strong>
              <ul>
                <li>Esta es una contraseña temporal generada automáticamente</li>
                <li>Te recomendamos cambiarla después de tu primer inicio de sesión</li>
                <li>Mantén esta información segura y no la compartas con nadie</li>
              </ul>
            </div>
            
            <p>Para iniciar sesión, visita nuestro sitio web y utiliza las credenciales proporcionadas arriba.</p>
            
            <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
            
            <p>¡Esperamos que disfrutes usando nuestra plataforma!</p>
            
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
