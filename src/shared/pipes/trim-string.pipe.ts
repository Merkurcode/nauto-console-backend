import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimStringPipe implements PipeTransform {
  transform(value: any, _metadata: ArgumentMetadata): any {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map(item => (typeof item === 'string' ? item.trim() : item));
    }

    if (value && typeof value === 'object') {
      const trimmedObject = { ...value };
      for (const key in trimmedObject) {
        if (typeof trimmedObject[key] === 'string') {
          trimmedObject[key] = trimmedObject[key].trim();
        }
      }

      return trimmedObject;
    }

    return value;
  }
}
