import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthTenant, StaffUserDto } from '@pixelcraft/types';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../common/guards/tenant-context.guard';
import {
  CreateStaffUserDto,
  UpdateStaffUserDto,
  VerifyPinDto,
} from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff & User Management')
@Controller('staff')
@UseGuards(JwtAuthGuard, TenantContextGuard)
@ApiBearerAuth('JWT-auth')
@ApiHeader({
  name: 'x-tenant-id',
  required: false,
  description: 'Optional organization tenant UUID to switch active session scope',
})
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({
    summary: 'List All Staff Members & Cashiers',
    description: 'Retrieves all user accounts and memberships under the active tenant.',
  })
  @ApiOkResponse({ description: 'List of staff members retrieved successfully.' })
  async listStaff(@CurrentTenant() tenant: AuthTenant): Promise<StaffUserDto[]> {
    return this.staffService.listStaff(tenant.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create Staff User Account',
    description: 'Creates a new user profile, sets role, hashes password & PIN, and binds to active tenant.',
  })
  @ApiOkResponse({ description: 'Staff member account created successfully.' })
  async createStaff(
    @CurrentTenant() tenant: AuthTenant,
    @Body() dto: CreateStaffUserDto,
  ): Promise<StaffUserDto> {
    return this.staffService.createStaff(tenant.id, dto);
  }

  @Post('verify-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify 4-Digit Terminal PIN',
    description: 'Validates a 4-digit PIN for rapid cashier switching on POS terminals.',
  })
  @ApiOkResponse({ description: 'Staff member profile if PIN is valid, null otherwise.' })
  async verifyPin(
    @CurrentTenant() tenant: AuthTenant,
    @Body() dto: VerifyPinDto,
  ): Promise<StaffUserDto | null> {
    return this.staffService.verifyPin(tenant.id, dto.pinCode);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get Staff Member Details',
    description: 'Retrieves full details of a specific staff user by ID.',
  })
  @ApiOkResponse({ description: 'Staff member profile retrieved successfully.' })
  async getStaffById(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<StaffUserDto> {
    return this.staffService.getStaffById(tenant.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update Staff Member',
    description: 'Updates name, email, role, branch assignment, active status, password, or PIN.',
  })
  @ApiOkResponse({ description: 'Staff member updated successfully.' })
  async updateStaff(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
    @Body() dto: UpdateStaffUserDto,
  ): Promise<StaffUserDto> {
    return this.staffService.updateStaff(tenant.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove Staff Member',
    description: 'Revokes organization access and soft-deletes business membership.',
  })
  @ApiOkResponse({ description: 'Staff member removed successfully.' })
  async deleteStaff(
    @CurrentTenant() tenant: AuthTenant,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.staffService.deleteStaff(tenant.id, id);
  }
}
