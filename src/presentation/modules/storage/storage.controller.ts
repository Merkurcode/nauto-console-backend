import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Inject,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';

// DTOs
import { InitiateMultipartUploadDto } from '@application/dtos/storage/initiate-multipart-upload.dto';
import { CompleteMultipartUploadDto } from '@application/dtos/storage/complete-multipart-upload.dto';
import { MoveFileDto } from '@application/dtos/storage/move-file.dto';
import { RenameFileDto } from '@application/dtos/storage/rename-file.dto';
import { SetFileVisibilityDto } from '@application/dtos/storage/set-file-visibility.dto';

// Response DTOs
import {
  InitiateMultipartUploadResponseDto,
  GeneratePartUrlResponseDto,
  FileResponseDto,
  GetFileSignedUrlResponseDto,
  GetUploadStatusResponseDto,
  GetUserFilesResponseDto,
  GetUserStorageQuotaResponseDto,
} from '@application/dtos/_responses/storage/storage.swagger.dto';

// Commands
import { InitiateMultipartUploadCommand } from '@application/commands/storage/initiate-multipart-upload.command';
import { GeneratePartUrlCommand } from '@application/commands/storage/generate-part-url.command';
import { CompleteMultipartUploadCommand } from '@application/commands/storage/complete-multipart-upload.command';
import { AbortMultipartUploadCommand } from '@application/commands/storage/abort-multipart-upload.command';
import { MoveFileCommand } from '@application/commands/storage/move-file.command';
import { RenameFileCommand } from '@application/commands/storage/rename-file.command';
import { DeleteFileCommand } from '@application/commands/storage/delete-file.command';
import { SetFileVisibilityCommand } from '@application/commands/storage/set-file-visibility.command';
import { ClearUserConcurrencySlotsCommand } from '@application/commands/storage/clear-user-concurrency-slots.command';
import { HeartbeatUploadCommand } from '@application/commands/storage/heartbeat-upload.command';

// Queries
import { GetUploadStatusQuery } from '@application/queries/storage/get-upload-status.query';
import { GetFileQuery } from '@application/queries/storage/get-file.query';
import { GetUserFilesQuery } from '@application/queries/storage/get-user-files.query';
import { GetFileSignedUrlQuery } from '@application/queries/storage/get-file-signed-url.query';
import { GetUserStorageQuotaQuery } from '@application/queries/storage/get-user-storage-quota.query';
import { GetConcurrencyStatsQuery } from '@application/queries/storage/get-concurrency-stats.query';
import { GetUserConcurrentCountQuery } from '@application/queries/storage/get-user-concurrent-count.query';
import { GetConcurrencyHealthQuery } from '@application/queries/storage/get-concurrency-health.query';

// Guards & Decorators
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { WriteOperation } from '@shared/decorators/write-operation.decorator';
import { CanRead, CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { Throttle } from '@shared/decorators/throttle.decorator';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '@presentation/guards/permissions.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { RootReadOnlyGuard } from '@presentation/guards/root-readonly.guard';
import { FileAuditInterceptor } from '@presentation/interceptors/file-audit.interceptor';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';

@ApiTags('storage')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, RootReadOnlyGuard)
@UseInterceptors(FileAuditInterceptor)
// @UseHealthGuard('storage') // Temporarily disabled for testing
@Controller('storage')
export class StorageController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly transactionService: TransactionService,
  ) {
    this.logger.setContext(StorageController.name);
  }

  // ============================================================================
  // MULTIPART UPLOAD OPERATIONS
  // ============================================================================

  @Post('multipart/initiate')
  @HttpCode(HttpStatus.CREATED)
  @WriteOperation('file')
  @CanWrite('file')
  @Throttle(60000, 10) // 10 new uploads per minute per user
  @ApiOperation({
    summary: 'Initiate multipart upload',
    description:
      'Creates a new file record and initiates a multipart upload session with the storage service. ' +
      'This endpoint validates file types, checks user quota, and manages concurrency limits. ' +
      'Returns a file ID and upload ID that must be used for subsequent part uploads.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Multipart upload initiated successfully',
    type: InitiateMultipartUploadResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request data' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'File type not allowed or quota exceeded',
  })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Concurrency limit exceeded' })
  async initiateMultipartUpload(
    @Body() dto: InitiateMultipartUploadDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<InitiateMultipartUploadResponseDto> {
    // 🐛 DEBUG - Storage Controller ejecutado: userId: ${user.sub}, filename: ${dto.filename}

    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new InitiateMultipartUploadCommand(
          user.sub,
          dto.path,
          dto.filename,
          dto.originalName,
          dto.mimeType,
          dto.size,
          dto.bucket,
        ),
      );
    });
  }

  @Post('multipart/:fileId/part/:partNumber/url')
  @HttpCode(HttpStatus.OK)
  @WriteOperation('file')
  @CanWrite('file')
  @Throttle(60000, 100) // 100 part URL requests per minute
  @ApiOperation({
    summary: 'Generate presigned URL for part upload',
    description:
      'Generates a time-limited presigned URL for uploading a specific part of a multipart upload. ' +
      'Part numbers must be between 1 and 10000. Each part (except the last) must be at least 5MB. ' +
      'The URL expires after the specified time (default: 1 hour).',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiParam({ name: 'partNumber', description: 'Part number (1-10000)' })
  @ApiQuery({
    name: 'expirationSeconds',
    required: false,
    description: 'URL expiration time in seconds (default: 3600)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presigned URL generated successfully',
    type: GeneratePartUrlResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File or upload not found' })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid part number or upload state',
  })
  async generatePartUrl(
    @Param('fileId') fileId: string,
    @Param('partNumber') partNumber: string,
    @Query('expirationSeconds') expirationSeconds?: string,
  ): Promise<GeneratePartUrlResponseDto> {
    return this.commandBus.execute(
      new GeneratePartUrlCommand(fileId, partNumber, expirationSeconds),
    );
  }

  @Post('multipart/:fileId/complete')
  @HttpCode(HttpStatus.OK)
  @WriteOperation('file')
  @CanWrite('file')
  @Throttle(60000, 20) // 20 completions per minute
  @ApiOperation({
    summary: 'Complete multipart upload',
    description:
      'Finalizes a multipart upload by combining all uploaded parts into a single file. ' +
      'Requires all parts to be uploaded with their ETags. Updates file status to COMPLETED, ' +
      'releases concurrency slots, and triggers file processing if configured.',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Multipart upload completed successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File or upload not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid parts or upload state' })
  async completeMultipartUpload(
    @Param('fileId') fileId: string,
    @Body() dto: CompleteMultipartUploadDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new CompleteMultipartUploadCommand(user.sub, fileId, dto.parts),
      );
    });
  }

  @Delete('multipart/:fileId/abort')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WriteOperation('file')
  @CanWrite('file')
  @Throttle(60000, 30) // 30 aborts per minute
  @ApiOperation({
    summary: 'Abort multipart upload',
    description:
      'Cancels an ongoing multipart upload and cleans up all resources. ' +
      'This will delete all uploaded parts, release concurrency slots, restore user quota, ' +
      'and mark the file as ABORTED. This operation cannot be undone.',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Multipart upload aborted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File or upload not found' })
  async abortMultipartUpload(
    @Param('fileId') fileId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new AbortMultipartUploadCommand(user.sub, fileId, 'Aborted by user'),
      );
    });
  }

  @Get('multipart/:fileId/status')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'Get upload status',
    description: 'Retrieves the current status of a multipart upload',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Upload status retrieved successfully',
    type: GetUploadStatusResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  async getUploadStatus(
    @Param('fileId') fileId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<GetUploadStatusResponseDto | null> {
    return this.queryBus.execute(new GetUploadStatusQuery(fileId, user.sub));
  }

  @Post('multipart/:fileId/heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanWrite('file')
  @Throttle(60000, 60) // 60 heartbeats per minute (1 per second)
  @ApiOperation({
    summary: 'Send upload heartbeat',
    description:
      'Keeps an active multipart upload session alive by updating its last activity timestamp. ' +
      'Prevents automatic cleanup of stale uploads. Should be called periodically (every 30-60 seconds) ' +
      'during long uploads to prevent timeout. Uploads inactive for 15+ minutes are automatically cleaned.',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Heartbeat processed successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File or upload not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Upload not in progress' })
  async sendUploadHeartbeat(
    @Param('fileId') fileId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    return this.commandBus.execute(new HeartbeatUploadCommand(user.sub, fileId));
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  @Get('files/:fileId')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'Get file details',
    description: 'Retrieves detailed information about a specific file',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File details retrieved successfully',
    type: FileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to private file' })
  async getFile(
    @Param('fileId') fileId: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.queryBus.execute(new GetFileQuery(fileId, user.sub));
  }

  @Get('files')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'Get user files',
    description: 'Retrieves a list of files owned by the current user',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by file status' })
  @ApiQuery({ name: 'path', required: false, description: 'Filter by path prefix' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of files to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of files to skip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User files retrieved successfully',
    type: GetUserFilesResponseDto,
  })
  async getUserFiles(
    @CurrentUser() user: IJwtPayload,
    @Query('status') status?: string,
    @Query('path') path?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<GetUserFilesResponseDto> {
    return this.queryBus.execute(new GetUserFilesQuery(user.sub, status, path, limit, offset));
  }

  @Put('files/:fileId/move')
  @WriteOperation('file')
  @CanWrite('file')
  @ApiOperation({
    summary: 'Move file to different path',
    description: 'Moves a file to a different virtual folder path',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File moved successfully',
    type: FileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot move file in current state' })
  async moveFile(
    @Param('fileId') fileId: string,
    @Body() dto: MoveFileDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new MoveFileCommand(fileId, dto.newPath, user.sub));
    });
  }

  @Put('files/:fileId/rename')
  @WriteOperation('file')
  @CanWrite('file')
  @ApiOperation({
    summary: 'Rename file',
    description: 'Changes the filename of an existing file',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File renamed successfully',
    type: FileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid filename' })
  async renameFile(
    @Param('fileId') fileId: string,
    @Body() dto: RenameFileDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new RenameFileCommand(fileId, dto.newFilename, user.sub));
    });
  }

  @Put('files/:fileId/visibility')
  @WriteOperation('file')
  @CanWrite('file')
  @ApiOperation({
    summary: 'Set file visibility',
    description: 'Changes whether a file is publicly accessible or private',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File visibility updated successfully',
    type: FileResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot change visibility in current state',
  })
  async setFileVisibility(
    @Param('fileId') fileId: string,
    @Body() dto: SetFileVisibilityDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new SetFileVisibilityCommand(fileId, dto.isPublic, user.sub));
    });
  }

  @Delete('files/:fileId')
  @WriteOperation('file')
  @CanDelete('file')
  @Throttle(60000, 20) // 20 deletions per minute
  @ApiOperation({
    summary: 'Delete file',
    description:
      'Soft deletes a file by marking it as deleted without physical removal from storage. ' +
      'Files can only be deleted if they are in COMPLETED or ERROR status. ' +
      'Add ?hard=true for immediate physical deletion. ' +
      'Soft-deleted files are permanently removed after 30 days.',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiQuery({
    name: 'hard',
    required: false,
    description: 'Perform hard delete (physical removal)',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'File deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Cannot delete file in current state' })
  async deleteFile(
    @Param('fileId') fileId: string,
    @CurrentUser() user: IJwtPayload,
    @Query('hard') hard?: string,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new DeleteFileCommand(fileId, user.sub, hard));
    });
  }

  @Get('files/:fileId/url')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Throttle(60000, 50) // 50 URL generations per minute
  @ApiOperation({
    summary: 'Get file signed URL',
    description:
      'Generates a time-limited presigned URL for secure file access. ' +
      'Private files require authentication and ownership verification. ' +
      'Public files can be accessed by anyone with the URL. ' +
      'Default expiration is 1 hour, maximum is 7 days.',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiQuery({
    name: 'expirationSeconds',
    required: false,
    description: 'URL expiration time in seconds (default: 3600)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Signed URL generated successfully',
    type: GetFileSignedUrlResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to private file' })
  async getFileSignedUrl(
    @Param('fileId') fileId: string,
    @CurrentUser() user: IJwtPayload,
    @Query('expirationSeconds') expirationSeconds?: string,
  ): Promise<GetFileSignedUrlResponseDto> {
    return this.queryBus.execute(new GetFileSignedUrlQuery(fileId, expirationSeconds, user.sub));
  }

  // ============================================================================
  // STORAGE QUOTA & MANAGEMENT
  // ============================================================================

  @Get('quota')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'Get user storage quota',
    description: 'Retrieves storage quota information and usage statistics for the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Storage quota retrieved successfully',
    type: GetUserStorageQuotaResponseDto,
  })
  async getUserStorageQuota(
    @CurrentUser() user: IJwtPayload,
  ): Promise<GetUserStorageQuotaResponseDto> {
    return this.queryBus.execute(new GetUserStorageQuotaQuery(user.sub));
  }

  // ============================================================================
  // CONCURRENCY MANAGEMENT (ROOT OPERATIONS)
  // ============================================================================

  @Get('concurrency/stats')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Get concurrency statistics',
    description: 'Retrieves statistics about concurrent uploads across all users',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Concurrency statistics retrieved successfully',
  })
  async getConcurrencyStats(): Promise<{
    totalActiveUsers: number;
    totalActiveUploads: number;
    averageUploadsPerUser: number;
  }> {
    return this.queryBus.execute(new GetConcurrencyStatsQuery());
  }

  @Get('concurrency/user/:userId/count')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Get user concurrent uploads count',
    description: 'Retrieves the current number of active uploads for a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to check concurrent uploads for',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User concurrent uploads count retrieved successfully',
  })
  async getUserConcurrentCount(
    @Param('userId') userId: string,
  ): Promise<{ userId: string; activeUploads: number }> {
    return this.queryBus.execute(new GetUserConcurrentCountQuery(userId));
  }

  @Delete('concurrency/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WriteOperation('file')
  @CanDelete('file')
  @Roles(RolesEnum.ROOT)
  @ApiOperation({
    summary: 'Clear user concurrency slots (ROOT)',
    description:
      'Force-clears all active upload concurrency slots for a specific user. ' +
      'Use this to resolve stuck uploads or when a user reports upload issues. ' +
      'This is an administrative operation that should be used with caution.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to clear concurrency slots for',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User concurrency slots cleared successfully',
  })
  @Throttle(60000, 5) // Configured via environment
  async clearUserConcurrencySlots(@Param('userId') userId: string): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(new ClearUserConcurrencySlotsCommand(userId));
    });
  }

  @Get('concurrency/health')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Check concurrency service health (ROOT)',
    description:
      'Performs a comprehensive health check on the concurrency service. ' +
      'Verifies Redis connectivity, Lua script loading, and basic operations. ' +
      'Returns true if all checks pass, false otherwise.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Concurrency service health check result',
  })
  async getConcurrencyHealth(): Promise<{ healthy: boolean }> {
    return this.queryBus.execute(new GetConcurrencyHealthQuery());
  }
}
