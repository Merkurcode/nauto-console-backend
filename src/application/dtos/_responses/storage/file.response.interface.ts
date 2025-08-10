export interface IFileResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}
