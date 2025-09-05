import { DomainException } from './domain-exceptions';

export class ProductMediaNotFoundException extends DomainException {
  constructor(mediaId?: string) {
    super(
      `Product media not found${mediaId ? ` with ID: ${mediaId}` : ''}`,
      'PRODUCT_MEDIA_NOT_FOUND',
    );
  }
}

export class UnauthorizedMediaAccessException extends DomainException {
  constructor() {
    super('Unauthorized access to product media', 'UNAUTHORIZED_MEDIA_ACCESS');
  }
}

export class DuplicateFavoriteMediaException extends DomainException {
  constructor() {
    super('Only one media file can be marked as favorite per product', 'DUPLICATE_FAVORITE_MEDIA');
  }
}

export class InvalidMediaFileTypeException extends DomainException {
  constructor(fileType: string) {
    super(`Invalid media file type: ${fileType}`, 'INVALID_MEDIA_FILE_TYPE');
  }
}
