import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@shared/decorators/throttle.decorator';
import { Public } from '@shared/decorators/public.decorator';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { GetPublicFileSignedUrlQuery } from '@application/queries/storage/get-public-file-signed-url.query';
import { GetFileSignedUrlResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileAuditInterceptor } from '@presentation/interceptors/file-audit.interceptor';

/**
 * Public Storage Controller
 *
 * Provides unauthenticated access to public files.
 * All endpoints in this controller are accessible without authentication,
 * but only public files can be accessed. Private files will return 403.
 *
 * Rate limiting is more restrictive than authenticated endpoints to prevent abuse.
 */
@ApiTags('public-storage')
@Controller('public/storage')
@UseInterceptors(FileAuditInterceptor)
export class PublicStorageController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('files/:fileId/url')
  @HttpCode(HttpStatus.OK)
  @Public() // Mark as public endpoint - no authentication required
  @Throttle(60000, 30) // 30 public URLs per minute (stricter than authenticated)
  @ApiOperation({
    summary: 'Get public file signed URL (No Auth Required)',
    description:
      'Generates a presigned URL for accessing a public file without authentication. ' +
      'Only files marked as public (isPublic=true) can be accessed through this endpoint. ' +
      'Private files will return 403 Forbidden. The generated URL has a limited expiration time ' +
      'and can be shared with anyone for temporary access to the public file.',
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
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'File is private or access denied' })
  async getPublicFileSignedUrl(
    @Param('fileId') fileId: string,
    @Query('expirationSeconds') expirationSeconds?: string,
  ): Promise<GetFileSignedUrlResponseDto> {
    return this.queryBus.execute(new GetPublicFileSignedUrlQuery(fileId, expirationSeconds));
  }
}
