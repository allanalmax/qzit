import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { JoinQuizDto } from './dto/join-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QuizService } from './quiz.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentHost } from '../auth/current-host.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new quiz' })
  createQuiz(
    @Body() createQuizDto: CreateQuizDto,
    @CurrentHost() host: JwtPayload,
  ) {
    return this.quizService.createQuiz(createQuizDto, host.sub);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all quizzes belonging to the authenticated host' })
  getMyQuizzes(@CurrentHost() host: JwtPayload) {
    return this.quizService.getMyQuizzes(host.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a quiz (title / rounds) while still in created state' })
  updateQuiz(
    @Param('id') id: string,
    @Body() dto: UpdateQuizDto,
    @CurrentHost() host: JwtPayload,
  ) {
    return this.quizService.updateQuiz(id, dto, host.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full quiz data by ID' })
  getQuizById(@Param('id') id: string) {
    return this.quizService.getQuizById(id);
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get post-game results and per-question statistics' })
  getQuizResults(@Param('id') id: string) {
    return this.quizService.getQuizResults(id);
  }

  @Get('lookup/:joinCode')
  @ApiOperation({ summary: 'Look up a quiz by participant join code (safe for participants)' })
  lookupByJoinCode(@Param('joinCode') joinCode: string) {
    return this.quizService.lookupByJoinCode(joinCode);
  }

  @Post('join')
  joinQuiz(@Body() joinQuizDto: JoinQuizDto) {
    return this.quizService.joinQuiz(joinQuizDto);
  }
}
