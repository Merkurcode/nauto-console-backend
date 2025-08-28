import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class NormalizeEmailParamPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim().toLowerCase();
  }
}
