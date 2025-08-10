import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileResponse } from '../dtos/_responses/storage/file.response.interface';
import { File } from '@core/entities/file.entity';
import { StorageService } from '@core/services/storage.service';

@Injectable()
export class FileMapper {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async toResponse(file: File): Promise<IFileResponse> {
    let url: string;

    if (file.isPublic) {
      url = `${this.configService.get<string>('storage.publicUrl')}/public/${file.path}`;
    } else {
      const fileUrl = await this.storageService.getFileUrl(file.id);
      url = fileUrl || '';
    }

    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      isPublic: file.isPublic,
      url,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  async toResponseList(files: File[]): Promise<IFileResponse[]> {
    const dtos: IFileResponse[] = [];
    for (const file of files) {
      dtos.push(await this.toResponse(file));
    }

    return dtos;
  }
}
