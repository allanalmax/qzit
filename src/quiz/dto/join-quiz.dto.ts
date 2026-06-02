import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class JoinQuizDto {
  @ApiProperty({ example: 'XYZ789' })
  @IsString()
  joinCode!: string;

  @ApiProperty({ example: 'Alice' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Team Alpha', description: 'Required for team mode' })
  @IsOptional()
  @IsString()
  teamName?: string;
}
