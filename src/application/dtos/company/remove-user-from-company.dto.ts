import { IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RemoveUserFromCompanyDto {
  @ApiProperty({
    description: 'The ID of the user to remove from the company',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
