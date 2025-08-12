import { IUserWithAuthResponse } from '../user/user.response';

/**
 * Interface for complete authentication response
 * Used when login flow is successfully completed
 */
export interface ILoginAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: IUserWithAuthResponse;
  message?: string;
}
