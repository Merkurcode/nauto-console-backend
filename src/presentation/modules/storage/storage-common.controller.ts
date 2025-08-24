// 1. Node modules
import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Request,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';

// 2. Application imports
import { InitiateCommonUploadCommand } from '@application/commands/storage/initiate-common-upload.command';
import { CompleteMultipartUploadCommand } from '@application/commands/storage/complete-multipart-upload.command';
import { AbortMultipartUploadCommand } from '@application/commands/storage/abort-multipart-upload.command';
import { GeneratePartUrlCommand } from '@application/commands/storage/generate-part-url.command';
import { CreateCommonFolderCommand } from '@application/commands/storage/create-common-folder.command';
import { DeleteCommonFolderCommand } from '@application/commands/storage/delete-common-folder.command';
import { DeleteCommonFileCommand } from '@application/commands/storage/delete-common-file.command';
import { MoveCommonFileCommand } from '@application/commands/storage/move-common-file.command';
import { RenameFileCommand } from '@application/commands/storage/rename-file.command';
import { SetFileVisibilityCommand } from '@application/commands/storage/set-file-visibility.command';
import { HeartbeatUploadCommand } from '@application/commands/storage/heartbeat-upload.command';
import { ClearUserConcurrencySlotsCommand } from '@application/commands/storage/clear-user-concurrency-slots.command';
import { GetFileByIdQuery } from '@application/queries/storage/get-file-by-id.query';
import { GetCommonDirectoryContentsQuery } from '@application/queries/storage/get-common-directory-contents.query';
import { GetUploadStatusQuery } from '@application/queries/storage/get-upload-status.query';
import { GetFileSignedUrlQuery } from '@application/queries/storage/get-file-signed-url.query';
import { GetUserStorageQuotaQuery } from '@application/queries/storage/get-user-storage-quota.query';
import { GetConcurrencyStatsQuery } from '@application/queries/storage/get-concurrency-stats.query';
import { GetUserConcurrentCountQuery } from '@application/queries/storage/get-user-concurrent-count.query';
import { GetConcurrencyHealthQuery } from '@application/queries/storage/get-concurrency-health.query';
import { InitiateMultipartUploadDto, CompleteMultipartUploadDto } from '@application/dtos/storage';
import { CreateCommonFolderDto } from '@application/dtos/storage/create-common-folder.dto';
import { MoveFileDto } from '@application/dtos/storage/move-file.dto';
import { RenameFileDto } from '@application/dtos/storage/rename-file.dto';
import { SetFileVisibilityDto } from '@application/dtos/storage/set-file-visibility.dto';
import {
  IInitiateMultipartUploadResponse,
  IFileResponse,
  ICreateFolderResponse,
  IGeneratePartUrlResponse,
  IDirectoryContentsResponse,
} from '@application/dtos/_responses/storage';
import {
  InitiateUploadDtoSwagger,
  CompleteUploadDtoSwagger,
  CreateFolderDtoSwagger,
} from '@application/dtos/storage/storage-input.swagger.dto';
import {
  InitiateMultipartUploadResponseDto,
  GeneratePartUrlResponseDto,
  CreateFolderResponseDto,
  FileResponseDto,
} from '@application/dtos/_responses/storage/storage.swagger.dto';

// 3. Infrastructure imports
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';

// 4. Presentation imports
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { Throttle } from '@shared/decorators/throttle.decorator';

// 5. Shared imports
import { CanRead, CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { DenyForRootReadOnly } from '@shared/decorators/root-readonly.decorator';
import { DeleteOperation } from '@shared/decorators/write-operation.decorator';
import { Roles } from '@shared/decorators/roles.decorator';
import { RolesEnum } from '@shared/constants/enums';
import { StorageAreaType } from '@shared/types/storage-areas.types';
import { StorageAreaUtils } from '@shared/utils/storage-area.utils';
import { SecurityHeadersInterceptor } from '@shared/interceptors/security-headers.interceptor';

interface IAuthenticatedRequest {
  user: {
    sub: string;
    companyId: string;
  };
}

/**
 * Storage Common Area Controller
 *
 * Handles file operations in company-shared common areas:
 * - Products area: /company-uuid/common/products/
 * - Marketing area: /company-uuid/common/marketing/
 */
@ApiTags('storage-common-areas')
@ApiBearerAuth('JWT-auth')
@Controller('storage/common')
@UseGuards(JwtAuthGuard, RolesGuard /* , ThrottlerGuard */)
@UseInterceptors(SecurityHeadersInterceptor)
export class StorageCommonController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  // ---------------------------
  // Common Area Upload Operations
  // ---------------------------

  @Post(':area/multipart/initiate')
  @HttpCode(HttpStatus.CREATED)
  // @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Initiate multipart upload in common area (All authenticated users)',
    description:
      'Creates a new multipart upload session for files in the specified common area shared across the company.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Full access to initiate uploads in any common area\n' +
      '- **Admin**: Full access to initiate uploads in any common area\n' +
      '- **Manager**: Can initiate uploads in any common area\n' +
      '- **Sales Agent**: Can initiate uploads in any common area\n' +
      '- **Guest**: Can initiate uploads in any common area\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Uploads are subject to company storage quotas and file type restrictions. Root readonly users cannot perform write operations.',
  })
  @ApiParam({
    name: 'area',
    enum: StorageAreaUtils.getAvailableAreas(),
    description: 'Common area type',
  })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({ type: InitiateUploadDtoSwagger })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Upload initiated successfully',
    type: InitiateMultipartUploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data or invalid path',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  @ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'Storage quota exceeded' })
  @ApiResponse({ status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, description: 'File type not allowed' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Concurrency limit exceeded' })
  async initiateCommonUpload(
    @Param('area') area: StorageAreaType,
    @Body() initiateUploadDto: InitiateMultipartUploadDto,
    @Request() req: IAuthenticatedRequest,
  ): Promise<IInitiateMultipartUploadResponse> {
    const commonFolder = StorageAreaUtils.areaToCommonFolder(area);

    return this.transactionService.executeInTransaction(async () => {
      const command = new InitiateCommonUploadCommand(
        commonFolder,
        initiateUploadDto.path,
        initiateUploadDto.filename,
        initiateUploadDto.originalName,
        initiateUploadDto.mimeType,
        initiateUploadDto.size,
        req.user.sub,
        req.user.companyId,
        initiateUploadDto.upsert || false,
      );

      return this.commandBus.execute(command);
    });
  }

  // ---------------------------
  // Shared Upload Operations (both areas)
  // ---------------------------

  @Post(':fileId/part/:partNumber/url')
  @HttpCode(HttpStatus.CREATED)
  // @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 part URLs per minute
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Generate presigned URL for part upload in common areas (All authenticated users)',
    description:
      'Generates a presigned URL for uploading a specific part of a multipart upload in common areas.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can generate part URLs for any file\n' +
      '- **Admin**: Can generate part URLs for company files\n' +
      '- **Manager**: Can generate part URLs for accessible files\n' +
      '- **Sales Agent**: Can generate part URLs for accessible files\n' +
      '- **Guest**: Can generate part URLs for accessible files\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** User must have access to the upload session. URLs have configurable expiration time. Root readonly users cannot perform write operations.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique identifier for the file upload session' })
  @ApiParam({ name: 'partNumber', description: 'Part number (1-10000)' })
  @ApiQuery({
    name: 'partSizeBytes',
    required: true,
    description: 'Size of the part to be uploaded in bytes (minimum 5MB except for last part)',
    type: Number,
  })
  @ApiQuery({
    name: 'expirationSeconds',
    required: false,
    description: 'URL expiration time in seconds (default: 3600)',
  })
  @ApiProduces('application/json')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Presigned URL generated successfully',
    type: GeneratePartUrlResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid part number or file not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to this file' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Upload session not found' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async generatePartUrl(
    @Param('fileId') fileId: string,
    @Param('partNumber') partNumber: string,
    @Query('partSizeBytes') partSizeBytes: string,
    @Query('expirationSeconds') expirationSeconds?: string,
  ): Promise<IGeneratePartUrlResponse> {
    const partSize = parseInt(partSizeBytes, 10);
    if (isNaN(partSize)) {
      throw new Error('partSizeBytes must be a valid number');
    }

    // Validate part size doesn't exceed 5GB
    const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5GB in bytes
    if (partSize > MAX_PART_SIZE) {
      throw new Error(`Part size cannot exceed 5GB (${MAX_PART_SIZE} bytes)`);
    }

    return this.transactionService.executeInTransaction(async () => {
      const command = new GeneratePartUrlCommand(fileId, partNumber, partSize, expirationSeconds);

      return this.commandBus.execute(command);
    });
  }

  @Post(':fileId/complete')
  @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 completions per minute
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Complete multipart upload in common areas (All authenticated users)',
    description:
      'Finalizes a multipart upload by assembling all uploaded parts in common areas.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can complete any upload session\n' +
      '- **Admin**: Can complete company upload sessions\n' +
      '- **Manager**: Can complete accessible upload sessions\n' +
      '- **Sales Agent**: Can complete accessible upload sessions\n' +
      '- **Guest**: Can complete accessible upload sessions\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** User must have initiated the upload session. All parts must be successfully uploaded. Root readonly users cannot perform write operations.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique identifier for the file upload session' })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({ type: CompleteUploadDtoSwagger })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Upload completed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid parts data or upload already completed',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to this file' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Upload session not found' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async completeUpload(
    @Param('fileId') fileId: string,
    @Body() completeUploadDto: CompleteMultipartUploadDto,
    @Request() req: IAuthenticatedRequest,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = new CompleteMultipartUploadCommand(
        req.user.sub,
        fileId,
        completeUploadDto.parts,
      );

      return this.commandBus.execute(command);
    });
  }

  @Delete(':fileId/abort')
  @HttpCode(HttpStatus.NO_CONTENT)
  // @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 aborts per minute
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Abort multipart upload in common areas (All authenticated users)',
    description:
      'Cancels an ongoing multipart upload and cleans up temporary parts in common areas.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can abort any upload session\n' +
      '- **Admin**: Can abort company upload sessions\n' +
      '- **Manager**: Can abort accessible upload sessions\n' +
      '- **Sales Agent**: Can abort accessible upload sessions\n' +
      '- **Guest**: Can abort accessible upload sessions\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** User must have access to the upload session. All temporary parts will be permanently deleted. Root readonly users cannot perform write operations.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique identifier for the file upload session' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Upload aborted successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to this file' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Upload session not found' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async abortUpload(
    @Param('fileId') fileId: string,
    @Request() req: IAuthenticatedRequest,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = new AbortMultipartUploadCommand(req.user.sub, fileId, 'User aborted upload');

      return this.commandBus.execute(command);
    });
  }

  @Get(':fileId/status')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'Get upload status in common areas',
    description: 'Retrieves the current status of a multipart upload in common areas',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Upload status retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  async getUploadStatus(@Param('fileId') fileId: string, @Request() req: IAuthenticatedRequest) {
    return this.queryBus.execute(new GetUploadStatusQuery(fileId, req.user.sub));
  }

  @Post(':fileId/heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanWrite('file')
  @DenyForRootReadOnly()
  @Throttle(60000, 60) // 60 heartbeats per minute (1 per second)
  @ApiOperation({
    summary: 'Send upload heartbeat in common areas',
    description:
      'Keeps an active multipart upload session alive in common areas by updating its last activity timestamp',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Heartbeat processed successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File or upload not found' })
  async sendUploadHeartbeat(
    @Param('fileId') fileId: string,
    @Request() req: IAuthenticatedRequest,
  ): Promise<void> {
    return this.commandBus.execute(new HeartbeatUploadCommand(req.user.sub, fileId));
  }

  // ---------------------------
  // Folder Operations
  // ---------------------------

  @Post(':area/folders')
  @HttpCode(HttpStatus.CREATED)
  // @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 folders per minute
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Create folder in common area (All authenticated users)',
    description:
      'Creates a virtual folder structure in the specified common area.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can create folders in any common area\n' +
      '- **Admin**: Can create folders in company common area\n' +
      '- **Manager**: Can create folders in common area\n' +
      '- **Sales Agent**: Can create folders in common area\n' +
      '- **Guest**: Can create folders in common area\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** Folder paths must be valid and within company boundaries. Root readonly users cannot perform write operations.',
  })
  @ApiParam({
    name: 'area',
    enum: StorageAreaUtils.getAvailableAreas(),
    description: 'Common area type',
  })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({ type: CreateFolderDtoSwagger })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Folder created successfully',
    type: CreateFolderResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid folder path' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async createCommonFolder(
    @Param('area') area: StorageAreaType,
    @Body() createFolderDto: CreateCommonFolderDto,
    @Request() req: IAuthenticatedRequest,
  ): Promise<ICreateFolderResponse> {
    const commonFolder = StorageAreaUtils.areaToCommonFolder(area);

    return this.transactionService.executeInTransaction(async () => {
      const command = new CreateCommonFolderCommand(
        commonFolder,
        createFolderDto.path,
        req.user.sub,
        req.user.companyId,
      );

      return this.commandBus.execute(command);
    });
  }

  @Delete(':area/folders')
  @DeleteOperation('file')
  @CanDelete('file')
  @ApiOperation({
    summary: 'Delete folder from common area',
    description:
      'Deletes a folder and selectively removes files based on ownership and visibility. ' +
      'Only files owned by the requester or marked as public will be deleted. ' +
      'Private files owned by others remain untouched. If the folder becomes empty, it is removed.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can delete folders from any common area\n' +
      '- **Admin**: Can delete folders from company common area\n' +
      '- **Manager**: Can delete folders from common area\n' +
      '- **Sales Agent**: Can delete folders from common area\n' +
      '- **Guest**: Can delete folders from common area\n\n' +
      '⚠️ **Warning**: Only owned or public files will be deleted. Private files owned by others remain untouched.',
  })
  @ApiParam({
    name: 'area',
    enum: StorageAreaUtils.getAvailableAreas(),
    description: 'Common area type',
  })
  @ApiQuery({
    name: 'path',
    description: 'Folder path to delete (e.g., "category1/subcategory")',
    required: true,
    type: String,
    example: 'brochures/2025',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Folder deletion completed (may include selective file deletion)',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number', description: 'Number of files actually deleted' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Folder not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to delete folder' })
  async deleteCommonFolder(
    @Param('area') area: StorageAreaType,
    @Query('path') path: string,
    @Req() req: IAuthenticatedRequest,
  ): Promise<{ deletedCount: number }> {
    return this.transactionService.executeInTransaction(async () => {
      const command = new DeleteCommonFolderCommand(
        area,
        path || '',
        req.user.sub,
        req.user.companyId,
      );

      return this.commandBus.execute(command);
    });
  }

  @Delete(':area/files/:filename')
  @DeleteOperation('file')
  @CanDelete('file')
  @ApiOperation({
    summary: 'Delete individual file from common area',
    description:
      'Deletes a specific file from the common area. ' +
      'Can delete files registered in database or physical files that only exist in storage. ' +
      'For database files, applies ownership and access control validation. ' +
      'For physical-only files, deletes directly from MinIO storage.',
  })
  @ApiParam({
    name: 'area',
    enum: StorageAreaUtils.getAvailableAreas(),
    description: 'Common area type',
  })
  @ApiParam({
    name: 'filename',
    description: 'Name of the file to delete',
    example: 'document.pdf',
  })
  @ApiQuery({
    name: 'path',
    required: false,
    description: 'Directory path where the file is located',
    example: 'documents/2024',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'File deleted successfully',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to delete file' })
  async deleteCommonFile(
    @Param('area') area: StorageAreaType,
    @Param('filename') filename: string,
    @Query('path') path: string = '',
    @Req() req: IAuthenticatedRequest,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      const command = new DeleteCommonFileCommand(
        area,
        path,
        filename,
        req.user.sub,
        req.user.companyId,
      );

      return this.commandBus.execute(command);
    });
  }

  // ---------------------------
  // Directory Contents (Files + Folders)
  // ---------------------------

  @Get(':area/directory')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'List directory contents in common area',
    description:
      'Retrieves both files and folders in a directory-like view for the specified common area. Returns folders first, then files, both sorted alphabetically.',
  })
  @ApiParam({
    name: 'area',
    enum: StorageAreaUtils.getAvailableAreas(),
    description: 'Common area type',
  })
  @ApiQuery({
    name: 'path',
    required: false,
    description: 'Directory path to list contents from',
    example: 'catalogs/2024',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (1-200)',
    example: '50',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    example: '0',
  })
  @ApiQuery({
    name: 'includePhysical',
    required: false,
    description: 'Include physical files from MinIO that are not in database (default: true)',
    type: Boolean,
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Directory contents retrieved successfully',
  })
  async getCommonDirectoryContents(
    @Param('area') area: StorageAreaType,
    @Req() req: IAuthenticatedRequest,
    @Query('path') path: string = '',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includePhysical') includePhysical?: string,
  ): Promise<IDirectoryContentsResponse> {
    const query = new GetCommonDirectoryContentsQuery(
      req.user.sub,
      req.user.companyId,
      area,
      path,
      limit,
      offset,
      includePhysical,
    );

    return this.queryBus.execute(query);
  }

  // ---------------------------
  // File Retrieval
  // ---------------------------

  @Get(':fileId')
  @HttpCode(HttpStatus.OK)
  // @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute
  @CanRead('file')
  @ApiOperation({
    summary: 'Get file details from common areas (All authenticated users)',
    description:
      'Retrieves detailed information about a specific file in common areas.\n\n' +
      '**Behavior by Role:**\n' +
      '- **Root**: Can access details of any file\n' +
      '- **Admin**: Can access details of company files\n' +
      '- **Manager**: Can access details of accessible files\n' +
      '- **Sales Agent**: Can access details of accessible files\n' +
      '- **Guest**: Can access details of accessible files\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:read</code>\n\n' +
      '👥 **Roles with Access:**\n' +
      '- <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>\n\n' +
      '⚠️ **Restrictions:** User must have access to the file within their company scope. Returns complete file metadata and status.',
  })
  @ApiParam({ name: 'fileId', description: 'Unique identifier for the file' })
  @ApiProduces('application/json')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File details retrieved successfully with presigned URL',
    schema: {
      allOf: [
        { $ref: '#/components/schemas/FileResponseDto' },
        {
          type: 'object',
          properties: {
            signedUrl: {
              type: 'string',
              description: 'Presigned URL for file access (only for uploaded files)',
              nullable: true,
            },
            signedUrlExpiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Expiration date of the signed URL',
              nullable: true,
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied to this file' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async getFileById(
    @Param('fileId') fileId: string,
    @Request() req: IAuthenticatedRequest,
  ): Promise<IFileResponse & { signedUrl?: string; signedUrlExpiresAt?: Date }> {
    const query = new GetFileByIdQuery(fileId, req.user.sub, req.user.companyId);

    return this.queryBus.execute(query);
  }

  // ---------------------------
  // File Management Operations
  // ---------------------------

  @Get('files/:fileId/url')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Throttle(60000, 50) // 50 URL generations per minute
  @ApiOperation({
    summary: 'Get file signed URL in common areas',
    description: 'Generates a time-limited presigned URL for secure file access in common areas',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiQuery({
    name: 'expirationSeconds',
    required: false,
    type: Number,
    description: 'URL expiration time in seconds (default: 3600, max: 604800)',
    example: 3600,
  })
  @ApiProduces('application/json')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Signed URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Presigned URL for file access',
          example: 'https://storage.example.com/bucket/file?signature=...',
        },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'URL expiration timestamp',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid expiration time',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to access file',
  })
  async getFileSignedUrl(
    @Param('fileId') fileId: string,
    @Request() req: IAuthenticatedRequest,
    @Query('expirationSeconds') expirationSeconds?: string,
  ) {
    return this.queryBus.execute(
      new GetFileSignedUrlQuery(fileId, expirationSeconds, req.user.sub),
    );
  }

  @Put(':area/files/:fileId/move')
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Move file to different path in common areas',
    description: 'Moves a file to a different virtual folder path within the specified common area',
  })
  @ApiParam({
    name: 'area',
    enum: StorageAreaUtils.getAvailableAreas(),
    description: 'Common area type (products or marketing)',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({
    type: MoveFileDto,
    description: 'New path information for the file',
    examples: {
      example1: {
        summary: 'Move to documents folder',
        value: {
          newPath: 'documents/archive/2025',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File moved successfully',
    type: FileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid path or validation failed',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to move file',
  })
  async moveFile(
    @Param('area') area: StorageAreaType,
    @Param('fileId') fileId: string,
    @Body() moveFileDto: MoveFileDto,
    @Request() req: IAuthenticatedRequest,
  ) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new MoveCommonFileCommand(
          fileId,
          area,
          moveFileDto.newPath,
          req.user.sub,
          req.user.companyId,
        ),
      );
    });
  }

  @Put('files/:fileId/rename')
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Rename file in common areas',
    description: 'Changes the filename of an existing file in common areas',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({
    type: RenameFileDto,
    description: 'New filename for the file',
    examples: {
      example1: {
        summary: 'Rename document',
        value: {
          newFilename: 'updated-document.pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File renamed successfully',
    type: FileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid filename or validation failed',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot rename file while uploading or insufficient permissions',
  })
  async renameFile(
    @Param('fileId') fileId: string,
    @Body() renameFileDto: RenameFileDto,
    @Request() req: IAuthenticatedRequest,
  ) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new RenameFileCommand(fileId, renameFileDto.newFilename, req.user.sub),
      );
    });
  }

  @Put('files/:fileId/visibility')
  @CanWrite('file')
  @DenyForRootReadOnly()
  @ApiOperation({
    summary: 'Set file visibility in common areas',
    description: 'Changes whether a file is publicly accessible or private in common areas',
  })
  @ApiParam({ name: 'fileId', description: 'File unique identifier' })
  @ApiConsumes('application/json')
  @ApiProduces('application/json')
  @ApiBody({
    type: SetFileVisibilityDto,
    description: 'File visibility settings',
    examples: {
      makePublic: {
        summary: 'Make file public',
        value: {
          isPublic: true,
        },
      },
      makePrivate: {
        summary: 'Make file private',
        value: {
          isPublic: false,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File visibility updated successfully',
    type: FileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid visibility setting',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions to change file visibility',
  })
  async setFileVisibility(
    @Param('fileId') fileId: string,
    @Body() visibilityDto: SetFileVisibilityDto,
    @Request() req: IAuthenticatedRequest,
  ) {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new SetFileVisibilityCommand(fileId, visibilityDto.isPublic, req.user.sub),
      );
    });
  }

  // ---------------------------
  // Storage Quota & Management
  // ---------------------------

  @Get('quota')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @ApiOperation({
    summary: 'Get user storage quota in common areas',
    description: 'Retrieves storage quota information and usage statistics for common areas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Storage quota retrieved successfully',
  })
  async getUserStorageQuota(@Request() req: IAuthenticatedRequest) {
    return this.queryBus.execute(new GetUserStorageQuotaQuery(req.user.sub));
  }

  // ---------------------------
  // Concurrency Management (ROOT OPERATIONS)
  // ---------------------------

  @Get('concurrency/stats')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Get concurrency statistics (ROOT)',
    description: 'Retrieves statistics about concurrent uploads across all users in common areas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Concurrency statistics retrieved successfully',
  })
  async getConcurrencyStats() {
    return this.queryBus.execute(new GetConcurrencyStatsQuery());
  }

  @Get('concurrency/user/:userId/count')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Get user concurrent uploads count (ROOT)',
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
  async getUserConcurrentCount(@Param('userId') userId: string) {
    return this.queryBus.execute(new GetUserConcurrentCountQuery(userId));
  }

  @Delete('concurrency/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CanDelete('file')
  @Roles(RolesEnum.ROOT)
  @DenyForRootReadOnly()
  @Throttle(60000, 5) // 5 concurrency operations per minute
  @ApiOperation({
    summary: 'Clear user concurrency slots (ROOT)',
    description:
      'Force-clears all active upload concurrency slots for a specific user in common areas by aborting all uploading files. ' +
      'Each file abort is processed in its own transaction with rollback logic for consistency. ' +
      'If any upload fails to abort properly, the entire operation fails and concurrency slots are not cleared ' +
      'to prevent negative count issues. This is an administrative operation that should be used with caution.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to clear concurrency slots for',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User concurrency slots cleared successfully',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description:
      'Failed to abort one or more uploads. Concurrency slots not cleared to prevent negative counts.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'Failed to abort 2 out of 5 uploads. Concurrency slots not cleared to prevent negative counts.',
        },
        error: {
          type: 'string',
          example: 'Internal Server Error',
        },
        statusCode: {
          type: 'number',
          example: 500,
        },
      },
    },
  })
  async clearUserConcurrencySlots(@Param('userId') userId: string): Promise<void> {
    return this.commandBus.execute(new ClearUserConcurrencySlotsCommand(userId));
  }

  @Get('concurrency/health')
  @HttpCode(HttpStatus.OK)
  @CanRead('file')
  @Roles(RolesEnum.ROOT, RolesEnum.ROOT_READONLY)
  @ApiOperation({
    summary: 'Check concurrency service health (ROOT)',
    description:
      'Performs a comprehensive health check on the concurrency service for common areas',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Concurrency service health check result',
  })
  async getConcurrencyHealth() {
    return this.queryBus.execute(new GetConcurrencyHealthQuery());
  }
}
