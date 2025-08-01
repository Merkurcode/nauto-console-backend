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

import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UploadFileCommand } from '@application/commands/storage/upload-file.command';
import { DeleteFileCommand } from '@application/commands/storage/delete-file.command';
import { UpdateFileAccessCommand } from '@application/commands/storage/update-file-access.command';
import { GetFileQuery } from '@application/queries/storage/get-file.query';
import { GetUserFilesQuery } from '@application/queries/storage/get-user-files.query';

import { UpdateFileAccessDto } from '@application/dtos/storage/update-file-access.dto';
import { FileResponseDto } from '@application/dtos/responses/file.response';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('upload')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Upload a file to the storage system\n\n**Required Permissions:** file:write\n**Required Roles:** Any authenticated user',
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

    return this.commandBus.execute(new UploadFileCommand(storageFile, user.sub));
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get file by ID',
    description:
      'Retrieve file information and content by ID\n\n**Required Permissions:** file:read\n**Required Roles:** Any authenticated user (with ownership/access restrictions)',
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
      'Get all files owned by the current user\n\n**Required Permissions:** file:read\n**Required Roles:** Any authenticated user',
  })
  async getUserFiles(@CurrentUser() user: IJwtPayload): Promise<FileResponseDto[]> {
    return this.queryBus.execute(new GetUserFilesQuery(user.sub));
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a file',
    description:
      'Delete a file from the storage system\n\n**Required Permissions:** file:delete\n**Required Roles:** Any authenticated user (own files only)\n**Restrictions:** Root readonly users cannot perform this operation',
  })
  @ApiParam({ name: 'id', description: 'File ID' })
  async deleteFile(@Param('id') id: string, @CurrentUser() user: IJwtPayload): Promise<void> {
    return this.commandBus.execute(new DeleteFileCommand(id, user.sub));
  }

  @Patch('access')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update file access (public/private)',
    description:
      'Change file visibility between public and private\n\n**Required Permissions:** file:write\n**Required Roles:** Any authenticated user (own files only)\n**Restrictions:** Root readonly users cannot perform this operation',
  })
  async updateFileAccess(
    @Body() updateFileAccessDto: UpdateFileAccessDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<FileResponseDto> {
    return this.commandBus.execute(
      new UpdateFileAccessCommand(
        updateFileAccessDto.fileId,
        updateFileAccessDto.isPublic,
        user.sub,
      ),
    );
  }
}
