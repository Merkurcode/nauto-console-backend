/* eslint-disable prettier/prettier */
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
  Inject,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';

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
import { AdminChangePasswordDto } from '@application/dtos/requests/auth/admin-change-password.dto';
import { ChangePasswordDto } from '@application/dtos/auth/change-password.dto';
import { ChangeEmailDto } from '@application/dtos/auth/change-email.dto';

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
import { AdminChangePasswordCommand } from '@application/commands/auth/admin-change-password.command';
import { ChangePasswordCommand } from '@application/commands/auth/change-password.command';
import { ChangeEmailCommand } from '@application/commands/auth/change-email.command';

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
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('auth')
@Throttle(60, 5) // 5 requests per minute
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
  ) {
    this.logger.setContext(AuthController.name);
  }

  private async executeInTransactionWithContext<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(async (tx) => {
      this.transactionContext.setTransactionClient(tx);
      
      try {
        return await callback();
      } finally {
        this.transactionContext.clearTransaction();
      }
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard, InvitationGuard)
  @RequirePermissions('auth:write')
  @WriteOperation('auth')
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Register a new user (invitation-based)',
    description: 'Register a new user in the system through invitation\n\n**Required Permissions:** auth:write\n**Required Roles:** root, admin, manager (users with invitation permissions)\n**Restrictions:** Root readonly users cannot perform this operation. Requires valid invitation token'
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User successfully registered' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'User with this email already exists' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to invite user',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async register(@Body() registerDto: RegisterDto, @CurrentUser() _currentUser: IJwtPayload) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new RegisterUserCommand(registerDto));
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Authenticate user and get tokens',
    description: 'Authenticate user credentials and retrieve access/refresh tokens\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)'
  })
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
    return this.executeInTransactionWithContext(async () => {
      const userAgent = req.headers['user-agent'];
      const ipAddress =
        req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null);

      return this.commandBus.execute(new LoginCommand(loginDto, userAgent, ipAddress));
    });
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Verify OTP code for 2FA',
    description: 'Verify OTP code for two-factor authentication\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'OTP verified successfully. Returns access token, refresh token, and user data.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid OTP code' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new VerifyOtpCommand(verifyOtpDto.userId, verifyOtpDto));
    });
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Refresh access token using refresh token',
    description: 'Get new access token using a valid refresh token\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully. Returns new access token and refresh token.',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new RefreshTokenCommand(refreshTokenDto));
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout the current user - local (current session) or global (all sessions)',
    description:
      'Local logout revokes only the current session, global logout revokes all user sessions\n\n**Required Permissions:** None (Authenticated users only)\n**Required Roles:** Any authenticated user',
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
    this.logger.debug({
      message: 'Logout request received',
      userId: user.sub,
      sessionToken: user.jti,
      scope: logoutDto.scope,
      email: user.email,
    });

    // Extract session token from JWT for local logout
    const currentSessionToken = user.jti; // Session token stored in JWT's jti claim

    // Validate that we have a session token for local logout
    if (logoutDto.scope === LogoutScope.LOCAL && !currentSessionToken) {
      throw new Error(
        'Session token not found in JWT. Local logout requires a valid session token.',
      );
    }

    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new LogoutCommand(user.sub, logoutDto.scope || LogoutScope.GLOBAL, currentSessionToken),
      );
    });
  }

  @Get('me')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get current user information',
    description: 'Get current authenticated user basic information\n\n**Required Permissions:** None (Authenticated users only)\n**Required Roles:** Any authenticated user'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'User information retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async me(@CurrentUser() user: IJwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      roles: user.roles,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Post('email/send-verification')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Send email verification code',
    description: 'Role-based access: Root can send to any email, Admin/Manager can send to emails within their company (and subsidiaries for Admin), other roles can only send to their own email. Only sends if email is not already verified.\n\n**Required Permissions:** Varies by role scope\n**Required Roles:** Any authenticated user (with role-based restrictions)'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verification email sent successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid email format' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions to send verification to this email' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email is already verified' })
  async sendVerificationEmail(
    @Body() sendVerificationEmailDto: SendVerificationEmailDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new SendVerificationEmailCommand(
          sendVerificationEmailDto,
          currentUser.sub,
          currentUser.roles,
          currentUser.companyId || null,
        ),
      );
    });
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with verification code',
    description:
      'Verify email with the code received. If successful, returns auth tokens like the login endpoint.\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)',
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
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new VerifyEmailCommand(verifyEmailDto));
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get('email/status/:email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check if an email is verified',
    description:
      'Role-based access: Root can check any email, Admin/Manager can check emails within their company, other roles can only check their own email\n\n**Required Permissions:** Varies by role scope\n**Required Roles:** Any authenticated user (with role-based restrictions)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns the verification status of the email',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to check this email',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid email format' })
  async checkEmailVerificationStatus(
    @Param('email') email: string,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    const isVerified = await this.commandBus.execute(
      new CheckEmailVerificationStatusCommand(
        email,
        currentUser.sub,
        currentUser.roles,
        currentUser.companyId || null,
      ),
    );

    return { verified: isVerified };
  }

  @Public()
  @Post('password/request-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Request a password reset email with captcha validation',
    description: 'Request password reset via email with captcha protection\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)'
  })
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
    return this.executeInTransactionWithContext(async () => {
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

      return this.commandBus.execute(
        new RequestPasswordResetCommand(requestPasswordResetDto, ipAddress, userAgent),
      );
    });
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Reset password with a token',
    description: 'Reset user password using a valid reset token\n\n**Required Permissions:** None (Public endpoint)\n**Required Roles:** None (Public endpoint)'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password reset successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired token' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid password format' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new ResetPasswordCommand(resetPasswordDto));
    });
  }

  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN)
  @Post('admin/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change password of any user (Root/Admin only)',
    description: 'Allow root and admin users to change passwords of other users\n\n**Required Permissions:** None (Role-based)\n**Required Roles:** root, admin\n**Restrictions:** Root can change any user password. Admin can only change passwords of users in their company'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Target user not found' })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions or user not in same company (for admin)' 
  })
  async adminChangePassword(
    @Body() adminChangePasswordDto: AdminChangePasswordDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new AdminChangePasswordCommand(
          adminChangePasswordDto.userId,
          adminChangePasswordDto.password,
          currentUser.sub,
          currentUser.roles, // All user roles
          currentUser.tenantId,
        ),
      );
    });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change current user password',
    description: 'Change own password with current password verification. Terminates all other sessions and returns new tokens.\n\n**Required Permissions:** None (Own password)\n**Required Roles:** Any authenticated user'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Password changed successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or current password incorrect' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new ChangePasswordCommand(
          user.sub,
          changePasswordDto.currentPassword,
          changePasswordDto.newPassword,
          user.jti, // Current session token
        ),
      );
    });
  }

  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change user email with role-based access control',
    description: 'Change user email with role-based authorization. Always requires the target user\'s password for verification:\n\n• **Regular users**: Can only change their own email (requires their own password)\n• **Admin users**: Can change emails of users in their company (requires target user\'s password)\n• **Root users**: Can change any user\'s email (requires target user\'s password)\n\n**⚠️ IMPORTANT RESTRICTION**: Root users\' emails cannot be changed by anyone, including themselves.\n\n**Required Permissions:** None (Role-based access)\n**Required Roles:** Any authenticated user (with role-based restrictions)'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Email changed successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data, email already in use, or target user password incorrect' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'User not authenticated' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions for the requested operation' })
  async changeEmail(
    @Body() changeEmailDto: ChangeEmailDto,
    @CurrentUser() user: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new ChangeEmailCommand(
          user.sub,
          user.roles,
          user.companyId || null,
          changeEmailDto.newEmail,
          changeEmailDto.currentPassword,
          changeEmailDto.targetUserId,
          user.jti, // Current session token
        ),
      );
    });
  }
}
