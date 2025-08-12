/**
 * Interface for BOT Token Provider
 * Infrastructure implementations must follow this contract
 */
export interface IBotTokenProvider {
  /**
   * Generate a BOT token (technical implementation)
   */
  generateToken(params: {
    botUserId: string;
    botEmail: string;
    tokenId: string;
    companyId?: string;
  }): Promise<{
    accessToken: string;
    expiresIn: string;
    tokenId: string;
  }>;

  /**
   * Validate a BOT token
   */
  validateToken(token: string): Promise<unknown | null>;

  /**
   * Revoke a BOT token
   */
  revokeToken(tokenId: string): Promise<boolean>;

  /**
   * List active BOT tokens
   */
  listActiveTokens(): Promise<
    Array<{
      tokenId: string;
      botUserId: string;
      companyId?: string;
      createdAt: Date;
    }>
  >;
}
