import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TrimPipe, TrimToNullPipe } from '@shared/pipes/trim.pipe';

// DTOs
import { CreateBulkProcessingRequestDto } from '@application/dtos/bulk-processing/create-bulk-processing-request.dto';
import { StartBulkProcessingDto } from '@application/dtos/bulk-processing/start-bulk-processing.dto';
import { CancelBulkProcessingDto } from '@application/dtos/bulk-processing/cancel-bulk-processing.dto';

// Response interfaces and types
import {
  IBulkProcessingRequestResponse,
  IBulkProcessingJobStatusResponse,
  IBulkProcessingStatusResponse,
  BulkProcessingRequestResponse,
} from '@application/dtos/_responses/bulk-processing-request/bulk-processing-request.response';
import { BulkProcessingJobStatusSwaggerDto } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-job-status.swagger.dto';
import { BulkProcessingStatusSwaggerDto } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-status.swagger.dto';

// Commands and Queries
import { CreateBulkProcessingRequestCommand } from '@application/commands/bulk-processing/create-bulk-processing-request.command';
import { StartBulkProcessingCommand } from '@application/commands/bulk-processing/start-bulk-processing.command';
import { CancelBulkProcessingCommand } from '@application/commands/bulk-processing/cancel-bulk-processing.command';
import { GetBulkProcessingRequestQuery } from '@application/queries/bulk-processing/get-bulk-processing-request.query';
import { GetBulkProcessingRequestsByCompanyQuery } from '@application/queries/bulk-processing/get-bulk-processing-requests-by-company.query';
import { GetBulkProcessingErrorReportQuery } from '@application/queries/bulk-processing/get-bulk-processing-error-report.query';
import { GetBulkProcessingWarningReportQuery } from '@application/queries/bulk-processing/get-bulk-processing-warning-report.query';

// Entities and Types
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';
import { BulkProcessingRequestMapper } from '@application/mappers/bulk-processing-request.mapper';

@ApiTags('bulk-processing')
@Controller('bulk-processing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class BulkProcessingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post('requests')
  @ApiOperation({
    summary: 'Create bulk processing request',
    description:
      'Creates a new bulk processing request for an uploaded file to process catalog data.\\n\\n' +
      '**Functionality:**\\n' +
      '- Creates bulk processing request entity\\n' +
      '- Links to uploaded file for processing\\n' +
      '- Sets initial status to PENDING\\n' +
      '- Associates with current user and company\\n\\n' +
      '**Supported Types:**\\n' +
      '- **PRODUCT_CATALOG**: Import product catalog data from Excel/CSV\\n\\n' +
      '**Permission Evaluation:**\\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:write)\\n\\n' +
      '⚠️ **Restrictions:** File must exist and be owned by the same company',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Bulk processing request created successfully',
    type: BulkProcessingRequestResponse,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'File not found' })
  async createBulkProcessingRequest(
    @Body() createBulkProcessingRequestDto: CreateBulkProcessingRequestDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IBulkProcessingRequestResponse> {
    return this.transactionService.executeInTransaction(async () => {
      const command = new CreateBulkProcessingRequestCommand(
        createBulkProcessingRequestDto.type,
        createBulkProcessingRequestDto.fileId,
        currentUser.companyId,
        currentUser.sub,
      );

      return this.commandBus.execute(command);
    });
  }

  @Post('requests/:requestId/start')
  @ApiOperation({
    summary: 'Start bulk processing execution',
    description:
      'Initiates the bulk processing execution for a PENDING request.\n\n' +
      '**Processing Flow:**\n' +
      '- Validates request is in PENDING status\n' +
      '- Changes status to PROCESSING\n' +
      '- Queues job in BullMQ for background processing\n' +
      '- Returns job ID for tracking\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:manage)\n\n' +
      "⚠️ **Restrictions:** Request must be in PENDING status and belong to user's company",
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk processing started successfully with job queued',
    type: BulkProcessingJobStatusSwaggerDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Request cannot be started' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  async startBulkProcessing(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @Body() startBulkProcessingDto: StartBulkProcessingDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IBulkProcessingJobStatusResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new StartBulkProcessingCommand(
          requestId,
          currentUser.companyId,
          currentUser.sub,
          startBulkProcessingDto.eventType,
          startBulkProcessingDto.options,
          startBulkProcessingDto.priority,
        ),
      );
    });
  }

  @Put('requests/:requestId/cancel')
  @ApiOperation({
    summary: 'Cancel bulk processing request',
    description:
      'Cancels a bulk processing request that is currently PENDING or PROCESSING.\n\n' +
      '**Cancellation Process:**\n' +
      '- Stops active queue job if processing\n' +
      '- Changes status to CANCELLED\n' +
      '- Preserves processed data up to cancellation point\n' +
      '- Records cancellation reason and timestamp\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:manage)\n\n' +
      '⚠️ **Restrictions:** Cannot cancel COMPLETED or FAILED requests',
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Request cancelled successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Request cannot be cancelled' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelBulkProcessing(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @Body() cancelBulkProcessingDto: CancelBulkProcessingDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new CancelBulkProcessingCommand(
          requestId,
          currentUser.companyId,
          currentUser.sub,
          cancelBulkProcessingDto.reason,
        ),
      );
    });
  }

  @Get('requests/:requestId')
  @ApiOperation({
    summary: 'Get bulk processing request details',
    description:
      'Retrieves detailed information about a specific bulk processing request.\n\n' +
      '**Returned Information:**\n' +
      '- Request metadata (ID, type, status, timestamps)\n' +
      '- Processing progress (total/processed/successful/failed rows)\n' +
      '- Error information if applicable\n' +
      '- File information and row logs\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:read)\n\n' +
      '⚠️ **Restrictions:** Users can only view requests from their own company',
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk processing request details',
    type: BulkProcessingRequestResponse,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  async getBulkProcessingRequest(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IBulkProcessingRequestResponse> {
    return this.queryBus.execute(
      new GetBulkProcessingRequestQuery(requestId, currentUser.companyId),
    );
  }

  @Get('requests')
  @ApiOperation({
    summary: 'List bulk processing requests with filtering',
    description:
      "Lists bulk processing requests for the user's company with comprehensive filtering options.\n\n" +
      '**Available Filters:**\n' +
      '- **Status**: Filter by processing status (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)\n' +
      '- **Type**: Filter by processing type (PRODUCT_CATALOG, etc.)\n' +
      '- **User**: Filter by requesting user ID\n' +
      '- **Pagination**: Limit and offset for result pagination\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:read)\n\n' +
      "⚠️ **Restrictions:** Results are automatically filtered by user's company context",
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: BulkProcessingStatus,
    description: 'Filter by processing status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: BulkProcessingType,
    description: 'Filter by processing type',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by requesting user ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Maximum number of results (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: 'number',
    description: 'Number of results to skip (default: 0)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of bulk processing requests',
    type: [BulkProcessingRequestResponse],
  })
  async getBulkProcessingRequests(
    @CurrentUser() currentUser: IJwtPayload,
    @Query('status', TrimToNullPipe) status?: BulkProcessingStatus,
    @Query('type', TrimToNullPipe) type?: BulkProcessingType,
    @Query('userId', TrimToNullPipe) userId?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ): Promise<IBulkProcessingRequestResponse[]> {
    return this.queryBus.execute(
      new GetBulkProcessingRequestsByCompanyQuery(
        currentUser.companyId,
        status,
        type,
        userId,
        Math.min(limit || 20, 100),
        Math.max(offset || 0, 0),
      ),
    );
  }

  @Get('requests/:requestId/status')
  @ApiOperation({
    summary: 'Get processing status and progress',
    description:
      'Retrieves current status and detailed progress information for a bulk processing request.\n\n' +
      '**Progress Information:**\n' +
      '- Current processing status\n' +
      '- Progress percentage calculation\n' +
      '- Row processing statistics (total, processed, successful, failed)\n' +
      '- Error status and timestamps\n\n' +
      '**Use Cases:**\n' +
      '- Real-time progress monitoring\n' +
      '- Frontend progress bars\n' +
      '- Processing completion detection\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:read)\n\n' +
      '⚠️ **Restrictions:** Users can only check status of requests from their company',
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current processing status with detailed progress information',
    type: BulkProcessingStatusSwaggerDto,
  })
  async getBulkProcessingStatus(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<IBulkProcessingStatusResponse> {
    const request = await this.queryBus.execute(
      new GetBulkProcessingRequestQuery(requestId, currentUser.companyId),
    );

    return BulkProcessingRequestMapper.toStatusResponse(request);
  }

  @Get('requests/:requestId/errors/download')
  @ApiOperation({
    summary: 'Download error report CSV',
    description:
      'Downloads a comprehensive CSV report of all errors encountered during bulk processing.\n\n' +
      '**Report Contents:**\n' +
      '- Row number and original data\n' +
      '- Error descriptions and validation failures\n' +
      '- Processing timestamps\n' +
      '- Suggested corrections when applicable\n\n' +
      '**File Format:**\n' +
      '- CSV format with UTF-8 encoding\n' +
      '- Filename includes request ID and date\n' +
      '- Headers for easy Excel import\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:read)\n\n' +
      "⚠️ **Restrictions:** Only available for requests with errors in user's company",
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV error report',
    headers: {
      'Content-Type': {
        description: 'MIME type',
        schema: { type: 'string', example: 'text/csv; charset=utf-8' },
      },
      'Content-Disposition': {
        description: 'Attachment filename',
        schema: { type: 'string', example: 'attachment; filename="errors-report.csv"' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found or no errors' })
  async downloadErrorReport(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @CurrentUser() currentUser: IJwtPayload,
    @Res() response: Response,
  ): Promise<void> {
    const errorLogs = await this.queryBus.execute(
      new GetBulkProcessingErrorReportQuery(requestId, currentUser.companyId),
    );

    if (!errorLogs) {
      throw new NotFoundException('No errors to report');
    }

    // Generate CSV report using the entity method
    const csvReport = BulkProcessingRequest.generateReport(errorLogs);

    const filename = `bulk-processing-errors-${requestId}-${new Date().toISOString().split('T')[0]}.csv`;

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(csvReport);
  }

  @Get('requests/:requestId/warnings/download')
  @ApiOperation({
    summary: 'Download warnings report CSV',
    description:
      'Downloads a comprehensive CSV report of all warnings encountered during bulk processing.\n\n' +
      '**Report Contents:**\n' +
      '- Row number and original data\n' +
      '- Warning descriptions and validation alerts\n' +
      '- Processing timestamps\n' +
      '- Suggested improvements when applicable\n\n' +
      '**File Format:**\n' +
      '- CSV format with UTF-8 encoding\n' +
      '- Filename includes request ID and date\n' +
      '- Headers for easy Excel import\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:read)\n\n' +
      "⚠️ **Restrictions:** Only available for requests with warnings in user's company",
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV warnings report',
    headers: {
      'Content-Type': {
        description: 'MIME type',
        schema: { type: 'string', example: 'text/csv; charset=utf-8' },
      },
      'Content-Disposition': {
        description: 'Attachment filename',
        schema: { type: 'string', example: 'attachment; filename="warnings-report.csv"' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found or no warnings' })
  async downloadWarningReport(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @CurrentUser() currentUser: IJwtPayload,
    @Res() response: Response,
  ): Promise<void> {
    const warningLogs = await this.queryBus.execute(
      new GetBulkProcessingWarningReportQuery(requestId, currentUser.companyId),
    );

    if (!warningLogs) {
      throw new NotFoundException('No warnings to report');
    }

    // Generate CSV report using the entity method
    const csvReport = BulkProcessingRequest.generateReport(warningLogs);

    const filename = `bulk-processing-warnings-${requestId}-${new Date().toISOString().split('T')[0]}.csv`;

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.send(csvReport);
  }

  @Delete('requests/:requestId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete bulk processing request',
    description:
      'Permanently deletes a bulk processing request and its associated data.\n\n' +
      '**Deletion Process:**\n' +
      '- Removes request entity and all row logs\n' +
      '- Cleans up temporary files if applicable\n' +
      '- Cannot delete PROCESSING requests (must cancel first)\n' +
      '- Irreversible operation\n\n' +
      '**Permission Evaluation:**\n' +
      '- Permissions are evaluated based on the specific type (e.g., bulk-processing-products:delete)\n\n' +
      '⚠️ **Restrictions:** Cannot delete active (PROCESSING) requests - cancel first',
  })
  @ApiParam({ name: 'requestId', description: 'Bulk processing request ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Request deleted successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot delete active request' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  async deleteBulkProcessingRequest(
    @Param('requestId', TrimPipe, ParseUUIDPipe) requestId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<void> {
    return this.transactionService.executeInTransaction(async () => {
      // First check if request can be deleted (not active)
      const request = await this.queryBus.execute(
        new GetBulkProcessingRequestQuery(requestId, currentUser.companyId),
      );

      if (request.status === BulkProcessingStatus.PROCESSING) {
        throw new BadRequestException(
          'Cannot delete an active bulk processing request. Cancel it first.',
        );
      }

      // TODO: Implement DeleteBulkProcessingRequestCommand for proper deletion
      // This should include cleanup of associated files and queue jobs
      throw new BadRequestException(
        'Bulk processing request deletion feature is currently under development',
      );
    });
  }
}
