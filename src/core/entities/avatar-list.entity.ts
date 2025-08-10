import { AggregateRoot } from '@core/events/domain-event.base';
import { AvatarListId } from '@core/value-objects/avatar-list-id.vo';

export interface IAvatarListProps {
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AvatarList extends AggregateRoot {
  private constructor(
    private readonly _id: AvatarListId,
    private readonly _props: IAvatarListProps,
  ) {
    super();
  }

  public static create(
    props: Omit<IAvatarListProps, 'createdAt' | 'updatedAt'>,
    id?: AvatarListId,
  ): AvatarList {
    const now = new Date();
    const avatarId = id || AvatarListId.create();

    return new AvatarList(avatarId, {
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstruct(id: AvatarListId, props: IAvatarListProps): AvatarList {
    return new AvatarList(id, props);
  }

  // Getters
  public get id(): AvatarListId {
    return this._id;
  }

  public get imageUrl(): string {
    return this._props.imageUrl;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business methods
  public updateImageUrl(imageUrl: string): void {
    if (!imageUrl || imageUrl.trim().length === 0) {
      throw new Error('Image URL cannot be empty');
    }

    if (this._props.imageUrl !== imageUrl) {
      this._props.imageUrl = imageUrl;
      this.touch();
    }
  }

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  // Validation
  public isValid(): boolean {
    return (
      !!this._props.imageUrl &&
      this._props.imageUrl.trim().length > 0 &&
      this.isValidUrl(this._props.imageUrl)
    );
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);

      return true;
    } catch {
      return false;
    }
  }
}
