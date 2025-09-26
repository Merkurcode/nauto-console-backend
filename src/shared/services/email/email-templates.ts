import { escapeHtml, escapeHtmlAttribute } from '@shared/utils/html-escape';

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
    const buttonUrl = escapeHtmlAttribute(dashboardUrl || '#');

    const companySection = companyName
      ? `<p>Has sido registrado en <strong>${escapeHtml(companyName)}</strong>.</p>`
      : '';

    const rolesSection =
      roles && roles.length > 0
        ? `<p><strong>Roles asignados:</strong> ${roles.map(role => escapeHtml(role)).join(', ')}</p>`
        : '';

    const primaryColor = colors?.primary || '#007bff';

    const year = new Date().getFullYear();

    const whiteAsset =
      'https://riaowrkbfhrhwcwqnamr.supabase.co/storage/v1/object/public/console/white.png';

    const bottomAsset =
      'https://riaowrkbfhrhwcwqnamr.supabase.co/storage/v1/object/public/console/background-container5.png';

    const nautoLogoAsset =
      'https://riaowrkbfhrhwcwqnamr.supabase.co/storage/v1/object/public/console/nauto-logo-clean.png';

    return `
      <!doctype html>
      <html lang="es" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="utf-8">
        <title>Bienvenido a ${appName || 'Nauto'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <meta name="color-scheme" content="light only">
        <meta name="supported-color-schemes" content="light only">
        <style>
          /* Gmail-first approach - usar solo estilos que Gmail soporta bien */
          table { border-collapse: collapse; }
          img { border: 0; display: block; outline: none; text-decoration: none; }

          /* Remover todas las clases CSS - usar solo inline styles */
          @media screen and (max-width: 520px) {
            .container { width: 100% !important; }
            .px-24 { padding-left: 16px !important; padding-right: 16px !important; }
            .hero-pad { padding: 20px 16px 150px 16px !important; }
            .btn { display: block !important; width: 100% !important; max-width: none !important; }
          }
        </style>
      </head>

      <body style="margin:0; padding:0; background-color:#EFEAFB; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;" bgcolor="#EFEAFB">
        <div style="display:none; max-height:0; overflow:hidden;">
          Invitación a ${appName || 'Nauto'}: completa tu registro con tus credenciales de acceso.
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EFEAFB" style="background-color:#EFEAFB;">
          <tr>
            <td align="center" bgcolor="#EFEAFB" style="background-color:#EFEAFB;">

              <table role="presentation" width="500" cellpadding="0" cellspacing="0" border="0" class="container" style="width:500px; margin:0 auto;">
                <tr>
                  <td style="padding:24px 24px 0 24px;" class="px-24">

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffdf9" style="background-color:#fffdf9; border-radius:14px; overflow:hidden;">
                      <tr>
                        <td bgcolor="#fffdf9" style="background-image:url('${whiteAsset}'); background-color:#fffdf9; background-repeat:repeat; background-size:cover; padding:32px 24px;" class="hero-pad">

                        <!-- LOGO -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" style="padding-bottom:20px;">
                                <img src="${nautoLogoAsset}"
                                    width="160" height="43" alt="${appName || 'nauto'}"
                                    style="display:block; border:0; outline:none; text-decoration:none; width:160px; height:auto;">
                              </td>
                            </tr>
                          </table>

                          <!-- Título -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" style="font-family:Arial, Helvetica, sans-serif; color:#382d79; font-size:28px; line-height:36px; font-weight:bold; padding:60px 8px;">
                                ¡Bienvenido a ${appName || 'nauto web'}! 👋
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="font-family:Arial, Helvetica, sans-serif; color:#382d79; font-size:16px; line-height:24px; padding:8px 10px 20px;">
                                Hola ${escapeHtml(firstName)}, ${companySection}${rolesSection}
                              </td>
                            </tr>
                          </table>

                          <!-- Credenciales Box -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F8F9FA" style="background-color:#F8F9FA; border-radius:8px; margin:20px 0;">
                            <tr>
                              <td bgcolor="#F8F9FA" style="background-color:#F8F9FA; padding:20px; font-family:Arial, Helvetica, sans-serif; border-radius:8px;">
                                <h3 style="color:#382d79; font-size:18px; margin:0 0 15px; font-weight:bold;">Tus credenciales de acceso:</h3>
                                <p style="margin:8px 0; color:#382d79; font-size:14px; line-height:1.4;">
                                  <strong>Email:</strong> ${escapeHtml(email)}
                                </p>
                                <p style="margin:8px 0; color:#382d79; font-size:14px; line-height:1.4;">
                                  <strong>Contraseña temporal:</strong>
                                  <span style="font-family: 'Courier New', monospace; font-weight: bold; background-color:#fffdf9; padding:4px 8px; border-radius:4px; color:${primaryColor};">
                                    ${escapeHtml(password)}
                                  </span>
                                </p>
                                </td>
                            </tr>
                          </table>

                          <!-- Warning Box -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFF3CD" style="background-color:#FFF3CD; border-radius:8px; margin:0 0 20px 0;">
                            <tr>
                              <td bgcolor="#FFF3CD" style="background-color:#FFF3CD; padding:12px; border-radius:8px;">
                                <p style="margin:0; color:#856404; font-size:13px; line-height:1.4; font-family:Arial, Helvetica, sans-serif;">
                                  <strong>⚠️ Importante:</strong> Esta es una contraseña temporal. Te recomendamos cambiarla después de tu primer inicio de sesión.
                                </p>
                              </td>
                            </tr>
                          </table>

                          <!-- Botón CTA -->
                          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                            <tr>
                              <td align="center">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="#E2E9FF" style="margin: 0 auto; border-radius:8px;">
                                  <tr>
                                    <td bgcolor="#E2E9FF" style="background-color:#E2E9FF; border-radius:8px; text-align:center;">
                                      <a href="${buttonUrl}" style="display:block; padding:12px 24px; color:#382d79; text-decoration:none; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold;">
                                        Acceder a la Plataforma
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>
                      <!-- Nueva fila sin padding para la imagen -->
                      <tr>
                        <td style="padding:0; border-radius:0;">
                          <!-- Imagen decorativa después del botón -->
                          <img src="${bottomAsset}"
                              width="100%" height="auto" alt="" border="0"
                              style="display:block; width:100%; height:auto; max-height:300px; object-fit:contain; border:0; border-radius:0 0 14px 14px;">
                        </td>
                      </tr>
                    </table>

                    <!-- Separador -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="height:24px; line-height:24px; font-size:0;">&nbsp;</td></tr>
                    </table>

                    <!-- Cuerpo secundario -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fffdf9" style="background-color:#fffdf9; border-radius:14px;">
                      <tr>
                        <td background="${whiteAsset}" bgcolor="#fffdf9" style="background-image:url('${whiteAsset}'); background-color:#fffdf9; background-repeat:repeat; background-size:cover; padding:20px 24px; font-family:Arial, Helvetica, sans-serif; color:#453970; font-size:14px; line-height:22px; border-radius:14px;">
                          Si no reconoces esta invitación, puedes ignorar este mensaje.
                        </td>
                      </tr>
                    </table>

                    <!-- Footer -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="height:20px; line-height:20px; font-size:0;">&nbsp;</td></tr>
                      <tr>
                        <td align="center" style="font-family:Arial, Helvetica, sans-serif; color:#6B658A; font-size:12px; line-height:18px; padding-bottom:24px;">
                          © <span>${year}</span> ${appName || 'Nauto'}. Todos los derechos reservados.
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  static verificationEmail(
    code: string,
    primaryColor: string = '#007bff',
    _appName: string = 'Nuestra Aplicación',
    expirationMinutes: number = 5,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verificación de Email</h2>
        <p>Tu código de verificación es:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: ${primaryColor}; margin: 0; font-size: 32px; letter-spacing: 5px;">${escapeHtml(code)}</h1>
        </div>
        <p>Este código expira en ${expirationMinutes} minutos.</p>
        <p>Si no solicitaste este código, puedes ignorar este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">Este es un email automático, por favor no respondas.</p>
      </div>
    `;
  }

  static passwordResetEmail(
    resetLink: string,
    primaryColor: string = '#007bff',
    _appName: string = 'Nuestra Aplicación',
    expirationMinutes: number = 60,
  ): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Restablecer Contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${escapeHtmlAttribute(resetLink)}" 
             style="background-color: ${primaryColor}; color: white; padding: 12px 25px; 
                    text-decoration: none; border-radius: 4px; font-weight: bold; 
                    display: inline-block;">
            Restablecer Contraseña
          </a>
        </div>
        <p>Este enlace expirará en ${expirationMinutes >= 60 ? Math.floor(expirationMinutes / 60) + ' hora' + (Math.floor(expirationMinutes / 60) > 1 ? 's' : '') : expirationMinutes + ' minutos'}.</p>
        <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este email o contactar a soporte.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">Este es un email automático, por favor no respondas.</p>
      </div>
    `;
  }

  //#region deprecated
  // static welcomeEmail(
  //   firstName: string,
  //   appName: string,
  //   companyName?: string,
  //   roles?: string[],
  //   dashboardUrl?: string,
  //   primaryColor: string = '#007bff',
  //   supportEmail: string = 'support@example.com',
  // ): string {
  //   const companyText = companyName ? ` de ${companyName}` : '';
  //   const invitationText = companyName
  //     ? `Has sido invitado a unirte a ${escapeHtml(companyName)} en ${escapeHtml(appName)}.`
  //     : `Tu cuenta en ${escapeHtml(appName)} ha sido creada exitosamente.`;
  //
  //   // Format roles list
  //   let rolesSection = '';
  //   if (roles && roles.length > 0) {
  //     const rolesList = roles.map(role => `<li>${role}</li>`).join('');
  //     rolesSection = `
  //       <p><strong>Tus roles asignados:</strong></p>
  //       <ul style="margin-left: 20px;">
  //         ${rolesList}
  //       </ul>
  //     `;
  //   }
  //
  //   return `
  //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  //       <h2 style="color: #333;">¡Bienvenido a ${escapeHtml(appName)}${companyText}!</h2>
  //       <p>Hola ${escapeHtml(firstName)},</p>
  //       <p>${invitationText}</p>
  //       ${rolesSection}
  //       <div style="text-align: center; margin: 30px 0;">
  //         <a href="${escapeHtmlAttribute(dashboardUrl || '#')}" 
  //            style="background-color: ${primaryColor}; color: white; padding: 12px 25px; 
  //                   text-decoration: none; border-radius: 4px; font-weight: bold; 
  //                   display: inline-block;">
  //           Acceder a ${escapeHtml(appName)}
  //         </a>
  //       </div>
  //       <p>Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte en <a href="mailto:${escapeHtmlAttribute(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
  //       <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  //       <p style="color: #666; font-size: 12px;">Este es un email automático, por favor no respondas.</p>
  //     </div>
  //   `;
  // }
  //#endregion
}
