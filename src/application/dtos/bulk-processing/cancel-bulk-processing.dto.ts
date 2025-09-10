import { ApiProperty } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelBulkProcessingDto {
  @ApiProperty({
    description: 'Reason for cancelling the bulk processing request',
    required: false,
    example: 'User requested cancellation',
  })
  @IsOptional()
  @IsString()
  @TrimAndValidateLength({ max: 500 })
  @MaxLength(500)
  reason?: string;
}
