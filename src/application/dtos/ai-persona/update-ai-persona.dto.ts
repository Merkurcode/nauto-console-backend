import { IsString, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TrimAndValidateLength } from '@shared/decorators/trim-and-validate-length.decorator';

export class UpdateAIPersonaDto {
  @ApiProperty({
    description: 'AI Persona tone (max 3 words, 255 characters)',
    maxLength: 255,
    example: 'warm and welcoming',
  })
  @IsString()
  @TrimAndValidateLength({ max: 255 })
  @IsNotEmpty()
  @Matches(/^(\S+\s*){1,3}$/, {
    message: 'Tone must contain at most 3 words',
  })
  tone: string;

  @ApiProperty({
    description: 'AI Persona personality (max 3 words)',
    maxLength: 255,
    example: 'helpful cheerful professional',
  })
  @IsString()
  @TrimAndValidateLength({ max: 255 })
  @IsNotEmpty()
  @Matches(/^(\S+\s*){1,3}$/, {
    message: 'Personality must contain at most 3 words',
  })
  personality: string;

  @ApiProperty({
    description: 'AI Persona objective',
    maxLength: 100,
    example:
      'Provide excellent customer service with personalized attention and effective solutions',
  })
  @IsString()
  @TrimAndValidateLength({ max: 100 })
  @IsNotEmpty()
  objective: string;

  @ApiProperty({
    description: 'AI Persona short details',
    maxLength: 75,
    example: 'Brief description of this AI persona',
  })
  @IsString()
  @TrimAndValidateLength({ max: 75 })
  @IsNotEmpty()
  shortDetails: string;
}
