import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController, ProcurementController],
  providers: [SuppliersService, ProcurementService],
  exports: [SuppliersService, ProcurementService],
})
export class ProcurementModule {}

