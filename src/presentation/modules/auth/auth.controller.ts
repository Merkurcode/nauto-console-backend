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
  ForbiddenException,
  Delete,
} from '@nestjs/common';
import { NormalizeEmailParamPipe } from '@shared/pipes/normalize-email-param.pipe';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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
import { AdminChangePasswordDto } from '@application/dtos/auth/admin-change-password.dto';
import { ChangePasswordDto } from '@application/dtos/auth/change-password.dto';
import { ChangeEmailDto } from '@application/dtos/auth/change-email.dto';
import { ResendInvitationDto } from '@application/dtos/auth/resend-invitation.dto';

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
import { DeleteUserInvitationCommand } from '@application/commands/auth/delete-user-invitation.command';
import { ResendUserInvitationCommand } from '@application/commands/auth/resend-user-invitation.command';

// Guards & Decorators
import { Public } from '@shared/decorators/public.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { Throttle } from '@shared/decorators/throttle.decorator';
import { WriteOperation } from '@shared/decorators/write-operation.decorator';
import { PreventRootAssignment } from '@shared/decorators/prevent-root-assignment.decorator';
import { RequirePermissions } from '@shared/decorators/permissions.decorator';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { InvitationGuard } from '@presentation/guards/invitation.guard';
import { RootAssignmentGuard } from '@presentation/guards/root-assignment.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { NoBots } from '@shared/decorators/bot-restrictions.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { UseHealthGuard } from 'src/queues/guards/health.guard';

@ApiTags('auth')
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

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard, InvitationGuard, RootAssignmentGuard)
  @Throttle(2, 5) // 5 requests per 2 seconds
  @RequirePermissions('auth:write')
  @WriteOperation('auth')
  @PreventRootAssignment()
  @Post('register')
  @NoBots()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseHealthGuard('auth-emails')
  @ApiBody({
    type: RegisterDto,
    description: 'User registration data including email, password, name, company, and optional profile/address information. Roles can be specified using RolesEnum values.',
  })
  @ApiOperation({
    summary: 'Register a new user (invitation-based)',
    description: 'Register a new user in the system through invitation\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">auth:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can invite users to any company\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can invite users to their company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can invite users with invitation permissions\n\n' +
      '⚠️ **Restrictions:** ROOT_READONLY users cannot perform this operation',
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
  @NoBots()
  @Throttle(60, 5) // 5 attempts per minute for login
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: LoginDto,
    description: 'User credentials for authentication (email and password)',
  })
  @ApiOperation({
    summary: 'Authenticate user and get tokens',
    description: 'Authenticate user credentials and retrieve access/refresh tokens\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
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
  @Throttle(60, 3) // 3 OTP attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: VerifyOtpDto,
    description: 'OTP verification data including userId and the 6-digit OTP code',
  })
  @ApiOperation({
    summary: 'Verify OTP code for 2FA',
    description: 'Verify OTP code for two-factor authentication\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
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
  @NoBots()
  @Throttle(60, 10) // 10 refresh attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token to obtain new access token',
  })
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description: 'Get new access token using a valid refresh token\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
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

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @Throttle(20, 2)
  @NoBots()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({
    type: LogoutDto,
    description: 'Logout scope configuration. Use LogoutScope.LOCAL for current session only or LogoutScope.GLOBAL for all sessions (default: GLOBAL)',
  })
  @ApiOperation({
    summary: 'Logout the current user - local (current session) or global (all sessions)',
    description:
      'Local logout revokes only the current session, global logout revokes all user sessions\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Authenticated)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any Authenticated User</code>',
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
    // Check if user is BOT - BOTs cannot logout
    const isBotUser = user.roles?.some(role => role === RolesEnum.BOT);
    if (isBotUser) {
      this.logger.warn({
        message: 'BOT user attempted logout - operation forbidden',
        userId: user.sub,
        email: user.email,
        roles: user.roles,
      });

      throw new ForbiddenException('BOT users cannot perform logout operation');
    }

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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user information',
    description: 'Get current authenticated user basic information\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Authenticated)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any Authenticated User</code>',
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
  @NoBots()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send email verification code',
    description: 'Send email verification code with role-based access control\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fef9e7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Role-based</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can send to any email\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can send to emails within company/subsidiaries\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can send to emails within company\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Others</code> - Can only send to own email',
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
  @Throttle(60, 2)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with verification code',
    description:
      'Verify email with the code received. If successful, returns auth tokens like the login endpoint.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
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
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Request()
      req: {
      headers: Record<string, string>;
      ip?: string;
      connection?: { remoteAddress?: string; socket?: { remoteAddress?: string } };
      socket?: { remoteAddress?: string };
    }) {
    return this.executeInTransactionWithContext(async () => {
      const userAgent = req.headers['user-agent'];
      const ipAddress =
        req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket ? req.connection.socket.remoteAddress : null);

      return this.commandBus.execute(new VerifyEmailCommand(verifyEmailDto, userAgent, ipAddress));
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Get('email/status/:email')
  @NoBots()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check if an email is verified',
    description:
      'Check email verification status with role-based access control\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fef9e7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Role-based</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can check any email\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can check emails within company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code> - Can check emails within company\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Others</code> - Can only check own email',
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
    @Param('email', TrimStringPipe, NormalizeEmailParamPipe) email: string,
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
  @NoBots()
  @Throttle(300, 3) // 3 reset requests per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email with captcha validation',
    description: 'Request password reset via email with captcha protection\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
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
  @NoBots()
  @Throttle(60, 1)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with a token',
    description: 'Reset user password using a valid reset token\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Public)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Public Endpoint</code>',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password reset successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid or expired token' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid password format' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new ResetPasswordCommand(resetPasswordDto));
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN)
  @Post('admin/change-password')
  @NoBots()
  @Throttle(30, 5)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Change password of any user (Root/Admin only)',
    description: 'Allow root and admin users to change passwords of other users\n\n' +
      '📋 **Required Permission:** <code style="color: #f39c12; background: #fef9e7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Role-based</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code> - Can change any user password\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code> - Can change passwords of users in their company',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Password changed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Target user not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions or user not in same company (for admin)',
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

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @NoBots()
  @Throttle(60, 5)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({
    type: ChangePasswordDto,
    description: 'Password change data including current password and new password',
  })
  @ApiOperation({
    summary: 'Change current user password',
    description: 'Change own password with current password verification. Terminates all other sessions and returns new tokens.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Own password)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any Authenticated User</code>',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
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

  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  @NoBots()
  @Throttle(30, 5)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({
    type: ChangeEmailDto,
    description: 'Email change data including new email, current password for verification, and optional target user ID (for admin operations)',
  })
  @ApiOperation({
    summary: 'Change user email with role-based access control',
    description: 'Change user email with role-based authorization. Always requires the target user\'s password for verification:\n\n• **Regular users**: Can only change their own email (requires their own password)\n• **Admin users**: Can change emails of users in their company (requires target user\'s password)\n• **Root users**: Can change any user\'s email (requires target user\'s password)\n\n**⚠️ IMPORTANT RESTRICTION**: Root users\' emails cannot be changed by anyone, including themselves.\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">None (Role-based)</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code> (with role-based restrictions)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email changed successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
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
          changeEmailDto.newEmail,
          changeEmailDto.currentPassword,
          changeEmailDto.targetUserId,
          user.jti, // Current session token
        ),
      );
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete('invitations/:userId')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER) // Admin and above can resend invitations
  @Throttle(2, 5)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete user invitation (Root only)',
    description:
      'Delete a pending or expired user invitation. This will completely remove the user from the system if their invitation is not yet completed.\n\n' +
      '📋 **Required Permission:** <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT ONLY</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>\n\n' +
      '⚠️ **Restrictions:** Can only delete pending or expired invitations. Completed invitations cannot be deleted.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User invitation deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User invitation deleted successfully. User user@example.com has been removed from the system.' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete invitation for completed users or users with error status'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only ROOT users can delete invitations',
  })
  async deleteUserInvitation(
    @Param('userId', TrimStringPipe) id: string,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new DeleteUserInvitationCommand(id, currentUser.sub),
      );
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('invitations/:userId/resend')
  @NoBots()
  @Roles(RolesEnum.ROOT, RolesEnum.ADMIN, RolesEnum.MANAGER) // Admin and above can resend invitations
  @Throttle(2, 5)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({
    type: ResendInvitationDto,
    description: 'Optional password configuration for the resent invitation',
    required: false,
  })
  @ApiOperation({
    summary: 'Resend user invitation (Root/Admin/Manager)',
    description:
      'Resend an invitation to a user with pending, expired, or error status. This will delete the existing user and recreate them with new credentials and fresh email/SMS notifications.\n\n' +
      '📋 **Access Levels:**\n' +
      '- <code style="color: #d63031; background: #ffcccc; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ROOT</code>: Can resend any invitation\n' +
      '- <code style="color: #0984e3; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">ADMIN</code>: Can resend invitations in their company\n' +
      '- <code style="color: #00b894; background: #e8f5e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">MANAGER</code>: Can resend invitations in their company\n\n' +
      '💡 **Password Options:**\n' +
      '- Provide a custom password in the request body\n' +
      '- Or leave empty to auto-generate a secure password\n\n' +
      '⚠️ **Restrictions:** Can only resend pending, expired, or error invitations. Completed invitations cannot be resent.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User invitation resent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User invitation resent successfully. New invitation emails and SMS have been sent to user@example.com.' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot resend invitation for completed users or invalid password format'
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have required permissions',
  })
  async resendUserInvitation(
    @Param('userId', TrimStringPipe) id: string,
    @Body() resendInvitationDto: ResendInvitationDto,
    @CurrentUser() currentUser: IJwtPayload,
  ) {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new ResendUserInvitationCommand(id, resendInvitationDto.password, currentUser.sub),
      );
    });
  }
}
