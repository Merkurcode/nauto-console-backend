import { IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimString } from '@shared/decorators/trim-and-validate-length.decorator';

export class AssignUserToCompanyDto {
  @ApiProperty({
    description: 'The ID of the user to assign to the company',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @TrimString()
  userId: string;

  @ApiProperty({
    description: 'The ID of the company to assign the user to',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  @TrimString()
  companyId: string;
}
