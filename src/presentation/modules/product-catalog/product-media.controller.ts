import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { CanRead, CanWrite, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { CreateProductMediaDto } from '@application/dtos/product-media/create-product-media.dto';
import { UpdateProductMediaDto } from '@application/dtos/product-media/update-product-media.dto';
import { ProductMediaResponse } from '@application/dtos/_responses/product-media/product-media.response';
import { CreateProductMediaCommand } from '@application/commands/product-media/create-product-media.command';
import { UpdateProductMediaCommand } from '@application/commands/product-media/update-product-media.command';
import { DeleteProductMediaCommand } from '@application/commands/product-media/delete-product-media.command';
import { GetProductMediaByProductQuery } from '@application/queries/product-media/get-product-media-by-product.query';

@ApiTags('product-media')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-media')
export class ProductMediaController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  @CanWrite('product-media')
  @ApiOperation({ summary: 'Create product media' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product media created successfully',
    type: ProductMediaResponse,
  })
  async create(
    @Body() createProductMediaDto: CreateProductMediaDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ProductMediaResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new CreateProductMediaCommand(
          createProductMediaDto,
          currentUser.companyId,
          currentUser.sub,
        ),
      );
    });
  }

  @Put(':id')
  @CanWrite('product-media')
  @ApiOperation({ summary: 'Update product media' })
  @ApiParam({ name: 'id', description: 'Product media ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product media updated successfully',
    type: ProductMediaResponse,
  })
  async update(
    @Param('id', TrimStringPipe) id: string,
    @Body() updateProductMediaDto: UpdateProductMediaDto,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ProductMediaResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new UpdateProductMediaCommand(
          id,
          updateProductMediaDto,
          currentUser.companyId,
          currentUser.sub,
        ),
      );
    });
  }

  @Delete(':id')
  @CanDelete('product-media')
  @ApiOperation({ summary: 'Delete product media' })
  @ApiParam({ name: 'id', description: 'Product media ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Product media deleted successfully',
  })
  async delete(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<void> {
    // Do not execute in transaction
    return this.commandBus.execute(
      new DeleteProductMediaCommand(id, currentUser.companyId, currentUser.sub),
    );
  }

  @Get('product/:productId')
  @CanRead('product-media')
  @ApiOperation({ summary: 'Get all media for a product' })
  @ApiParam({ name: 'productId', description: 'Product catalog ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product media retrieved successfully',
    type: [ProductMediaResponse],
  })
  async getByProduct(
    @Param('productId', TrimStringPipe) productId: string,
    @CurrentUser() currentUser: IJwtPayload,
  ): Promise<ProductMediaResponse[]> {
    return this.queryBus.execute(
      new GetProductMediaByProductQuery(productId, currentUser.companyId, currentUser.sub),
    );
  }
}
