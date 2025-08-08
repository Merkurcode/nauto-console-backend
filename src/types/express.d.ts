import { User } from '@core/entities/user.entity';
import { IJwtPayload } from '@application/dtos/responses/user.response';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Request {
      user?: User | IJwtPayload;
      skipThrottling?: boolean;
      isBotRequest?: boolean;
    }
  }
}

export {};
