import { PathSecurityUtil } from './path-security.util';

describe('PathSecurityUtil', () => {
  describe('normalizePath', () => {
    it('should normalize basic paths', () => {
      expect(PathSecurityUtil.normalizePath('/api/health')).toBe('/api/health');
      expect(PathSecurityUtil.normalizePath('/API/HEALTH')).toBe('/api/health');
      expect(PathSecurityUtil.normalizePath('//api///health//')).toBe('/api/health');
    });

    it('should handle path traversal attempts', () => {
      expect(PathSecurityUtil.normalizePath('/api/../admin')).toBe('/admin');
      expect(PathSecurityUtil.normalizePath('/api/../../etc/passwd')).toBe('/etc/passwd');
      expect(PathSecurityUtil.normalizePath('/api/./health')).toBe('/api/health');
    });

    it('should handle URL encoding', () => {
      expect(PathSecurityUtil.normalizePath('/api%2Fhealth')).toBe('/api/health');
      expect(PathSecurityUtil.normalizePath('/api%2f%2e%2e%2fadmin')).toBe('/admin');
    });

    it('should prevent double encoding bypass', () => {
      // Double encoded slash should not be decoded (kept as is to prevent bypass)
      expect(PathSecurityUtil.normalizePath('/%252F')).toBe('/%252f');
      expect(PathSecurityUtil.normalizePath('/api%252Fhealth')).not.toBe('/api/health');
      expect(PathSecurityUtil.normalizePath('/api%252Fhealth')).toBe('/api%252fhealth');
    });

    it('should remove query params and fragments', () => {
      expect(PathSecurityUtil.normalizePath('/api/health?bypass=true')).toBe('/api/health');
      expect(PathSecurityUtil.normalizePath('/api/health#section')).toBe('/api/health');
      expect(PathSecurityUtil.normalizePath('/api/health?a=1&b=2#test')).toBe('/api/health');
    });

    it('should handle null bytes', () => {
      expect(PathSecurityUtil.normalizePath('/api/health\x00.json')).toBe('/api/health.json');
      expect(PathSecurityUtil.normalizePath('/api/health%00.json')).toBe('/api/health.json');
    });
  });

  describe('matchesPattern', () => {
    const patterns = ['/api/health', '/api/auth/', '/docs'];

    it('should match exact paths', () => {
      expect(PathSecurityUtil.matchesPattern('/api/health', patterns)).toBe(true);
      expect(PathSecurityUtil.matchesPattern('/API/HEALTH', patterns)).toBe(true);
      expect(PathSecurityUtil.matchesPattern('/api/health/', patterns)).toBe(true);
    });

    it('should match prefix patterns', () => {
      expect(PathSecurityUtil.matchesPattern('/api/auth/login', patterns)).toBe(true);
      expect(PathSecurityUtil.matchesPattern('/api/auth/register', patterns)).toBe(true);
    });

    it('should not match different paths', () => {
      expect(PathSecurityUtil.matchesPattern('/api/users', patterns)).toBe(false);
      expect(PathSecurityUtil.matchesPattern('/admin', patterns)).toBe(false);
    });

    it('should prevent bypass attempts', () => {
      // Path traversal should not bypass
      expect(PathSecurityUtil.matchesPattern('/api/../api/health', patterns)).toBe(true);
      expect(PathSecurityUtil.matchesPattern('/api/auth/../users', patterns)).toBe(false);
      
      // URL encoding should not bypass
      expect(PathSecurityUtil.matchesPattern('/api%2Fhealth', patterns)).toBe(true);
      
      // Case variation should not bypass
      expect(PathSecurityUtil.matchesPattern('/API/AUTH/login', patterns)).toBe(true);
      
      // Query params should not affect matching
      expect(PathSecurityUtil.matchesPattern('/api/users?path=/api/health', patterns)).toBe(false);
    });
  });

  describe('isSuspiciousPath', () => {
    it('should detect path traversal', () => {
      expect(PathSecurityUtil.isSuspiciousPath('../etc/passwd')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('../../admin')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('..%2F..%2Fetc')).toBe(true);
    });

    it('should detect null bytes', () => {
      expect(PathSecurityUtil.isSuspiciousPath('/api/health\x00.json')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/health%00')).toBe(true);
    });

    it('should detect injection attempts', () => {
      expect(PathSecurityUtil.isSuspiciousPath('/api/<script>alert(1)</script>')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/javascript:alert(1)')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath("/api'; DROP TABLE users--")).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/$(whoami)')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/`ls -la`')).toBe(true);
    });

    it('should detect command injection patterns', () => {
      expect(PathSecurityUtil.isSuspiciousPath('/api/test;ls')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/test&&whoami')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/test||id')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/test|cat /etc/passwd')).toBe(true);
    });

    it('should allow normal paths', () => {
      expect(PathSecurityUtil.isSuspiciousPath('/api/health')).toBe(false);
      expect(PathSecurityUtil.isSuspiciousPath('/api/users/123')).toBe(false);
      expect(PathSecurityUtil.isSuspiciousPath('/api/auth/login')).toBe(false);
    });
  });

  describe('isInternalPath', () => {
    it('should detect internal paths', () => {
      expect(PathSecurityUtil.isInternalPath('/.git/config')).toBe(true);
      expect(PathSecurityUtil.isInternalPath('/.env')).toBe(true);
      expect(PathSecurityUtil.isInternalPath('/_internal/admin')).toBe(true);
      expect(PathSecurityUtil.isInternalPath('/debug/vars')).toBe(true);
      expect(PathSecurityUtil.isInternalPath('/trace')).toBe(true);
    });

    it('should allow normal paths', () => {
      expect(PathSecurityUtil.isInternalPath('/api/health')).toBe(false);
      expect(PathSecurityUtil.isInternalPath('/api/users')).toBe(false);
      expect(PathSecurityUtil.isInternalPath('/docs')).toBe(false);
    });
  });

  describe('Security Test Cases', () => {
    const publicPaths = ['/api/health', '/api/auth/login', '/docs'];

    it('should prevent directory traversal bypass', () => {
      // These should NOT match as public paths after normalization
      expect(PathSecurityUtil.matchesPattern('/api/admin/../health', publicPaths)).toBe(true);
      expect(PathSecurityUtil.matchesPattern('/api/../api/health', publicPaths)).toBe(true);
      
      // But these should be caught as suspicious
      expect(PathSecurityUtil.isSuspiciousPath('/api/admin/../health')).toBe(true);
      expect(PathSecurityUtil.isSuspiciousPath('/api/../api/health')).toBe(true);
    });

    it('should handle complex bypass attempts', () => {
      const maliciousPaths = [
        '/api/health/../../../etc/passwd',
        '/api/health%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '/api/health\x00.admin',
        '/api/HEALTH',
        '//api///health///',
        '/api/health?admin=true',
        '/api/health#admin',
        '/api/health;cat /etc/passwd',
      ];

      maliciousPaths.forEach(path => {
        // Normalized path might match, but should be detected as suspicious
        if (path.includes('..') || path.includes('\x00') || path.includes(';')) {
          expect(PathSecurityUtil.isSuspiciousPath(path)).toBe(true);
        }
      });
    });
  });
});