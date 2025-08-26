/**
 * HTML Escape Utility
 * 
 * Escapes special characters in strings to prevent HTML injection
 * and ensure proper display of user-generated content in emails
 */

/**
 * Escapes HTML special characters in a string
 * @param text The text to escape
 * @returns HTML-safe escaped string
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return text.replace(/[&<>"'`=/]/g, char => htmlEscapeMap[char]);
}

/**
 * Escapes HTML but preserves certain safe HTML tags for formatting
 * Useful for content that needs basic formatting but should be safe from injection
 */
export function escapeHtmlKeepBasicFormatting(text: string | undefined | null): string {
  if (!text) return '';
  
  // First escape everything
  let escaped = escapeHtml(text);
  
  // Then restore safe tags
  const safeTagPatterns = [
    { escaped: '&lt;b&gt;', original: '<b>' },
    { escaped: '&lt;/b&gt;', original: '</b>' },
    { escaped: '&lt;strong&gt;', original: '<strong>' },
    { escaped: '&lt;/strong&gt;', original: '</strong>' },
    { escaped: '&lt;i&gt;', original: '<i>' },
    { escaped: '&lt;/i&gt;', original: '</i>' },
    { escaped: '&lt;em&gt;', original: '<em>' },
    { escaped: '&lt;/em&gt;', original: '</em>' },
    { escaped: '&lt;br&gt;', original: '<br>' },
    { escaped: '&lt;br /&gt;', original: '<br />' },
    { escaped: '&lt;br/&gt;', original: '<br/>' },
  ];
  
  safeTagPatterns.forEach(pattern => {
    escaped = escaped.replace(new RegExp(pattern.escaped, 'g'), pattern.original);
  });
  
  return escaped;
}

/**
 * Ensures text is safe for use in HTML attributes
 * More aggressive escaping for use in attributes like title="", alt="", etc.
 */
export function escapeHtmlAttribute(text: string | undefined | null): string {
  if (!text) return '';
  
  // Escape HTML first
  let escaped = escapeHtml(text);
  
  // Additional escaping for attributes
  escaped = escaped.replace(/[\r\n]/g, '');  // Remove newlines
  escaped = escaped.replace(/\s+/g, ' ');    // Normalize whitespace
  
  return escaped;
}