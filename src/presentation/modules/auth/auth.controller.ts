import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

// DTOs
import { RegisterDto } from '@application/dtos/auth/register.dto';
import { LoginDto } from '@application/dtos/auth/login.dto';
import { VerifyOtpDto } from '@application/dtos/auth/verify-otp.dto';
import { RefreshTokenDto } from '@application/dtos/auth/refresh-token.dto';
import { LogoutDto, LogoutScope } from '@application/dtos/auth/logout.dto';
import {
  SendVerificationEmailDto,
  VerifyEmailDto,
} from '@application/dtos/auth/email-verification.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from '@application/dtos/auth/password-reset.dto';

// Commands
import { RegisterUserCommand } from '@application/commands/auth/register-user.command';
import { LoginCommand } from '@application/commands/auth/login.command';
import { VerifyOtpCommand } from '@application/commands/auth/verify-otp.command';
import { RefreshTokenCommand } from '@application/commands/auth/refresh-token.command';
import { LogoutCommand } from '@application/commands/auth/logout.command';
import { SendVerificationEmailCommand } from '@application/commands/auth/send-verification-email.command';
import { VerifyEmailCommand } from '@application/commands/auth/verify-email.command';
import { CheckEmailVerificationStatusCommand } from '@application/commands/auth/check-email-verification-status.command';
import { RequestPasswordResetCommand } from '@application/commands/auth/request-password-reset.command';
import { ResetPasswordCommand } from '@application/commands/auth/reset-password.command';

// Guards & Decorators
import { Public } from '@shared/decorators/public.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { SkipThrottle, Throttle } from '@shared/decorators/throttle.decorator';
import { WriteOperation } from '@shared/decorators/write-operation.decorator';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { InvitationGuard } from '@presentation/guards/invitation.guard';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('auth')
@Throttle(60, 5) // 5 requests per minute
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard, InvitationGuard)
  @RequirePermissions('auth:write')
  @WriteOperation('auth')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Register a new user (invitation-based)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User successfully registered' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'User with this email already exists' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to invite user',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async register(@Body() registerDto: RegisterDto, @CurrentUser() _currentUser: IJwtPayload) {
    return this.commandBus.execute(new RegisterUserCommand(registerDto));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and get tokens' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'User successfully authenticated. Returns access token, refresh token, and user data. May return OTP requirement if 2FA is enabled.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Request()
    req: {
      headers: Record<string, string>;
      ip?: string;
      connection?: { remoteAddress?: string; socket?: { remoteAddress?: string } };
      socket?: { remoteAddress?: string };
    },
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);

    return this.commandBus.execute(new LoginCommand(loginDto, userAgent, ipAddress));
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code for 2FA' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP verified successfully. Returns access token, refresh token, and user data.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid OTP code' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.commandBus.execute(new VerifyOtpCommand(verifyOtpDto.userId, verifyOtpDto));
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully. Returns new access token and refresh token.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.commandBus.execute(new RefreshTokenCommand(refreshTokenDto));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout the current user - local (current session) or global (all sessions)',
    description:
      'Local logout revokes only the current session, global logout revokes all user sessions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User logged out successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out from current session successfully' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Session token required for local logout',
  })
  async logout(@CurrentUser() user: IJwtPayload, @Body() logoutDto: LogoutDto) {
    console.log('DEBUG: Logout - Full user object:', user);
    console.log('DEBUG: Logout - Session token (jti):', user.jti);
    console.log('DEBUG: Logout - Scope requested:', logoutDto.scope);

    // Extract session token from JWT for local logout
    const currentSessionToken = user.jti; // Session token stored in JWT's jti claim

    // Validate that we have a session token for local logout
    if (logoutDto.scope === LogoutScope.LOCAL && !currentSessionToken) {
      throw new Error(
        'Session token not found in JWT. Local logout requires a valid session token.',
      );
    }

    return this.commandBus.execute(
      new LogoutCommand(user.sub, logoutDto.scope || LogoutScope.GLOBAL, currentSessionToken),
    );
  }

  @Get('me')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User information retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async me(@CurrentUser() user: IJwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      roles: user.roles,
    };
  }

  @Public()
  @Post('email/send-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send email verification code' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verification email sent successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid email format' })
  async sendVerificationEmail(@Body() sendVerificationEmailDto: SendVerificationEmailDto) {
    return this.commandBus.execute(new SendVerificationEmailCommand(sendVerificationEmailDto));
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with verification code',
    description:
      'Verify email with the code received. If successful, returns auth tokens like the login endpoint.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Email verified successfully. Returns access token, refresh token, and user data if verification successful.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired verification code',
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.commandBus.execute(new VerifyEmailCommand(verifyEmailDto));
  }

  @Public()
  @Get('email/status/:email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if an email is verified' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the verification status of the email',
  })
  async checkEmailVerificationStatus(@Param('email') email: string) {
    const isVerified = await this.commandBus.execute(
      new CheckEmailVerificationStatusCommand(email),
    );

    return { verified: isVerified };
  }

  @Public()
  @Post('password/request-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email with captcha validation' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password reset email sent successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid email format or captcha' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestPasswordResetDto,
    @Request()
    req: {
      headers: Record<string, string>;
      ip?: string;
      connection?: { remoteAddress?: string; socket?: { remoteAddress?: string } };
      socket?: { remoteAddress?: string };
    },
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

    return this.commandBus.execute(
      new RequestPasswordResetCommand(requestPasswordResetDto, ipAddress, userAgent),
    );
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with a token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password reset successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired token' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid password format' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.commandBus.execute(new ResetPasswordCommand(resetPasswordDto));
  }
}
