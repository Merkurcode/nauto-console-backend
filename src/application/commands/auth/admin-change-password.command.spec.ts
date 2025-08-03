import { Test, TestingModule } from '@nestjs/testing';
import { AdminChangePasswordCommandHandler, AdminChangePasswordCommand } from './admin-change-password.command';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException, ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { User } from '@core/entities/user.entity';
import { Email } from '@core/value-objects/email.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { RolesEnum } from '@shared/constants/enums';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AdminChangePasswordCommandHandler', () => {
  let handler: AdminChangePasswordCommandHandler;
  let userRepository: jest.Mocked<IUserRepository>;
  let authService: jest.Mocked<AuthService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findById: jest.fn(),
      update: jest.fn(),
    };

    const mockAuthService = {};
    const mockUserService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminChangePasswordCommandHandler,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    handler = module.get<AdminChangePasswordCommandHandler>(AdminChangePasswordCommandHandler);
    userRepository = module.get(USER_REPOSITORY);
    authService = module.get(AuthService);
    userService = module.get(UserService);

    // Setup bcrypt mock
    mockBcrypt.hash.mockResolvedValue('hashedPassword' as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully change password when user is root', async () => {
      // Arrange
      const targetUserId = 'target-user-id';
      const newPassword = 'NewP@ssw0rd123';
      const adminUserId = 'admin-user-id';
      const adminRole = RolesEnum.ROOT;

      const mockUser = {
        id: { getValue: () => targetUserId },
        email: { getValue: () => 'target@test.com' },
        companyId: CompanyId.fromString('company-id'),
        changePassword: jest.fn(),
      } as unknown as User;

      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(mockUser);

      const command = new AdminChangePasswordCommand(
        targetUserId,
        newPassword,
        adminUserId,
        adminRole,
        undefined,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(userRepository.findById).toHaveBeenCalledWith(targetUserId);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUser.changePassword).toHaveBeenCalledWith('hashedPassword');
      expect(userRepository.update).toHaveBeenCalledWith(mockUser);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Password updated successfully');
    });

    it('should successfully change password when admin changes password of user in same company', async () => {
      // Arrange
      const targetUserId = 'target-user-id';
      const newPassword = 'NewP@ssw0rd123';
      const adminUserId = 'admin-user-id';
      const adminRole = RolesEnum.ADMIN;
      const companyId = 'same-company-id';

      const mockUser = {
        id: { getValue: () => targetUserId },
        email: { getValue: () => 'target@test.com' },
        companyId: { getValue: () => companyId },
        changePassword: jest.fn(),
      } as unknown as User;

      userRepository.findById.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue(mockUser);

      const command = new AdminChangePasswordCommand(
        targetUserId,
        newPassword,
        adminUserId,
        adminRole,
        companyId,
      );

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should throw EntityNotFoundException when target user does not exist', async () => {
      // Arrange
      const command = new AdminChangePasswordCommand(
        'non-existent-user',
        'NewP@ssw0rd123',
        'admin-id',
        RolesEnum.ROOT,
        undefined,
      );

      userRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(EntityNotFoundException);
    });

    it('should throw ForbiddenActionException when admin tries to change password of user in different company', async () => {
      // Arrange
      const mockUser = {
        companyId: { getValue: () => 'different-company-id' },
      } as unknown as User;

      userRepository.findById.mockResolvedValue(mockUser);

      const command = new AdminChangePasswordCommand(
        'target-user-id',
        'NewP@ssw0rd123',
        'admin-id',
        RolesEnum.ADMIN,
        'admin-company-id',
      );

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ForbiddenActionException);
    });

    it('should throw ForbiddenActionException when user with insufficient role tries to change password', async () => {
      // Arrange
      const command = new AdminChangePasswordCommand(
        'target-user-id',
        'NewP@ssw0rd123',
        'user-id',
        RolesEnum.SALES_AGENT,
        undefined,
      );

      const mockUser = {} as User;
      userRepository.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(ForbiddenActionException);
    });
  });
});