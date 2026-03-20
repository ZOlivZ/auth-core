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
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ScimService } from './scim.service';
import { ScimBearerGuard } from './scim-bearer.guard';
import { SCIM_CONTENT_TYPE, type ScimPatchRequest } from './scim.dto';

@Controller('scim/v2')
@UseGuards(ScimBearerGuard)
export class ScimController {
  constructor(private readonly scimService: ScimService) {}

  private getBaseUrl(req: any): string {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get?.('host') || req.headers.host || 'localhost';
    return `${proto}://${host}`;
  }

  private setScimContentType(res: any): void {
    res.setHeader('Content-Type', SCIM_CONTENT_TYPE);
  }

  @Get('Users')
  async listUsers(
    @Query('filter') filter: string | undefined,
    @Query('startIndex') startIndex: string | undefined,
    @Query('count') count: string | undefined,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    const baseUrl = this.getBaseUrl(req);
    return this.scimService.listUsers(
      baseUrl,
      filter,
      startIndex ? parseInt(startIndex, 10) : undefined,
      count ? parseInt(count, 10) : undefined,
    );
  }

  @Get('Users/:id')
  async getUser(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.getUser(id, this.getBaseUrl(req));
  }

  @Post('Users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.createUser(body, this.getBaseUrl(req));
  }

  @Put('Users/:id')
  async replaceUser(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.replaceUser(id, body, this.getBaseUrl(req));
  }

  @Patch('Users/:id')
  async patchUser(
    @Param('id') id: string,
    @Body() body: ScimPatchRequest,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.patchUser(id, body, this.getBaseUrl(req));
  }

  @Delete('Users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string) {
    await this.scimService.deleteUser(id);
  }

  @Get('ServiceProviderConfig')
  getServiceProviderConfig(@Res({ passthrough: true }) res: any) {
    this.setScimContentType(res);
    return this.scimService.getServiceProviderConfig();
  }
}
