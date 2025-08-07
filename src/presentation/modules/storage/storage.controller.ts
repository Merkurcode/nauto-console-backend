import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';

import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UploadFileCommand } from '@application/commands/storage/upload-file.command';
import { DeleteFileCommand } from '@application/commands/storage/delete-file.command';
import { UpdateFileAccessCommand } from '@application/commands/storage/update-file-access.command';
import { GetFileQuery } from '@application/queries/storage/get-file.query';
import { GetUserFilesQuery } from '@application/queries/storage/get-user-files.query';

import { UpdateFileAccessDto } from '@application/dtos/storage/update-file-access.dto';
import { FileResponseDto } from '@application/dtos/responses/file.response';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StorageController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  private async executeInTransactionWithContext<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(async tx => {
      this.transactionContext.setTransactionClient(tx);

      try {
        return await callback();
      } finally {
        this.transactionContext.clearTransaction();
      }
    });
  }

  @Post('upload')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Upload a file to the storage system\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: /(jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    const storageFile = {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };

    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new UploadFileCommand(storageFile, user.sub));
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get file by ID',
    description:
      'Retrieve file information and content by ID\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code> (with ownership/access restrictions)',
  })
  @ApiParam({ name: 'id', description: 'File ID' })
  async getFile(
    @Param('id') id: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.queryBus.execute(new GetFileQuery(id, user.sub));
  }

  @Get('user/files')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all files for the current user',
    description:
      'Get all files owned by the current user\n\n' +
      '📋 **Required Permission:** <code style="color: #27ae60; background: #e8f8f5; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:read</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code>',
  })
  async getUserFiles(@CurrentUser() user: IJwtPayload): Promise<FileResponseDto[]> {
    return this.queryBus.execute(new GetUserFilesQuery(user.sub));
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a file',
    description:
      'Delete a file from the storage system\n\n' +
      '📋 **Required Permission:** <code style="color: #c0392b; background: #fadbd8; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:delete</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code> (own files only)\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiParam({ name: 'id', description: 'File ID' })
  async deleteFile(@Param('id') id: string, @CurrentUser() user: IJwtPayload): Promise<void> {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(new DeleteFileCommand(id, user.sub));
    });
  }

  @Patch('access')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update file access (public/private)',
    description:
      'Change file visibility between public and private\n\n' +
      '📋 **Required Permission:** <code style="color: #e74c3c; background: #ffeaa7; padding: 2px 6px; border-radius: 3px; font-weight: bold;">file:write</code>\n\n' +
      '👥 **Roles with Access:** <code style="color: #636e72; background: #dfe6e9; padding: 2px 6px; border-radius: 3px; font-weight: bold;">Any authenticated user</code> (own files only)\n\n' +
      '⚠️ **Restrictions:** Root readonly users cannot perform this operation',
  })
  async updateFileAccess(
    @Body() updateFileAccessDto: UpdateFileAccessDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.executeInTransactionWithContext(async () => {
      return this.commandBus.execute(
        new UpdateFileAccessCommand(
          updateFileAccessDto.fileId,
          updateFileAccessDto.isPublic,
          user.sub,
        ),
      );
    });
  }
}
