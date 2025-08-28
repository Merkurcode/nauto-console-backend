import { IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class RemoveUserFromCompanyDto {
  @ApiProperty({
    description: 'The ID of the user to remove from the company',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @TrimString()
  userId: string;
}
