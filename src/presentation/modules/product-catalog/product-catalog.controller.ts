import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrimStringPipe } from '@shared/pipes/trim-string.pipe';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { RolesGuard } from '@presentation/guards/roles.guard';
import { WriteOperation } from '@shared/decorators/write-operation.decorator';
import { CanRead, CanDelete } from '@shared/decorators/resource-permissions.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';
import { CreateProductCatalogDto } from '@application/dtos/product-catalog/create-product-catalog.dto';
import { UpdateProductCatalogDto } from '@application/dtos/product-catalog/update-product-catalog.dto';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { UpsertProductCatalogCommand } from '@application/commands/product-catalog/upsert-product-catalog.command';
import { UpdateProductCatalogCommand } from '@application/commands/product-catalog/update-product-catalog.command';
import { DeleteProductCatalogWithMediaCommand } from '@application/commands/product-catalog/delete-product-catalog-with-media.command';
import { GetProductCatalogQuery } from '@application/queries/product-catalog/get-product-catalog.query';
import { GetProductCatalogsByCompanyQuery } from '@application/queries/product-catalog/get-product-catalogs-by-company.query';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

@ApiTags('product-catalog')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('product-catalog')
export class ProductCatalogController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly transactionService: TransactionService,
  ) {}

  @Post()
  @WriteOperation('product-catalog')
  @ApiOperation({ summary: 'Create or update product catalog (upsert)' })
  @ApiResponse({
    status: 201,
    description: 'Product catalog created or updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'File not found (for technicalSheetId or photosId)' })
  async upsertProductCatalog(
    @Body() createDto: CreateProductCatalogDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IProductCatalogResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new UpsertProductCatalogCommand(createDto, user.companyId!, user.sub),
      );
    });
  }

  @Put(':id')
  @WriteOperation('product-catalog')
  @ApiOperation({ summary: 'Update product catalog' })
  @ApiParam({ name: 'id', description: 'Product catalog ID' })
  @ApiResponse({
    status: 200,
    description: 'Product catalog updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to update this catalog' })
  @ApiResponse({ status: 404, description: 'Product catalog not found' })
  async updateProductCatalog(
    @Param('id', TrimStringPipe) id: string,
    @Body() updateDto: UpdateProductCatalogDto,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IProductCatalogResponse> {
    return this.transactionService.executeInTransaction(async () => {
      return this.commandBus.execute(
        new UpdateProductCatalogCommand(id, updateDto, user.companyId!, user.sub),
      );
    });
  }

  @Delete(':id')
  @CanDelete('product-catalog')
  @ApiOperation({ summary: 'Delete product catalog' })
  @ApiParam({ name: 'id', description: 'Product catalog ID' })
  @ApiResponse({
    status: 204,
    description: 'Product catalog deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to delete this catalog' })
  @ApiResponse({ status: 404, description: 'Product catalog not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProductCatalog(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<void> {
    // Do not execute in transaction
    return this.commandBus.execute(
      new DeleteProductCatalogWithMediaCommand(id, user.companyId!, user.sub),
    );
  }

  @Get(':id')
  @CanRead('product-catalog')
  @ApiOperation({ summary: 'Get product catalog by ID' })
  @ApiParam({ name: 'id', description: 'Product catalog ID' })
  @ApiResponse({
    status: 200,
    description: 'Product catalog retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to view this catalog' })
  @ApiResponse({ status: 404, description: 'Product catalog not found' })
  async getProductCatalog(
    @Param('id', TrimStringPipe) id: string,
    @CurrentUser() user: IJwtPayload,
  ): Promise<IProductCatalogResponse> {
    return this.queryBus.execute(new GetProductCatalogQuery(id, user.companyId!, user.sub));
  }

  @Get()
  @CanRead('product-catalog')
  @ApiOperation({ summary: 'Get all product catalogs for company' })
  @ApiQuery({ name: 'industry', required: false, description: 'Filter by industry' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by type' })
  @ApiQuery({ name: 'subcategory', required: false, description: 'Filter by subcategory' })
  @ApiResponse({
    status: 200,
    description: 'Product catalogs retrieved successfully',
    type: [Object], // Should be IProductCatalogResponse[] but Swagger doesn't support that syntax
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProductCatalogs(
    @CurrentUser() user: IJwtPayload,
    @Query('industry', TrimStringPipe) industry?: string,
    @Query('type', TrimStringPipe) type?: string,
    @Query('subcategory', TrimStringPipe) subcategory?: string,
  ): Promise<IProductCatalogResponse[]> {
    return this.queryBus.execute(
      new GetProductCatalogsByCompanyQuery(user.companyId!, user.sub, {
        industry,
        type,
        subcategory,
      }),
    );
  }
}
