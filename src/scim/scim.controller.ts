import {
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

/**
 * SCIM 2.0 Users controller.
 *
 * Uses @Req().body instead of @Body() to bypass any global ValidationPipe
 * that would strip SCIM properties (whitelist:true strips undecorated fields).
 */
@Controller('scim/v2')
@UseGuards(ScimBearerGuard)
export class ScimController {
  constructor(private readonly scimService: ScimService) {}

  /**
   * Get the raw body, preferring __scimBody (saved before ValidationPipe)
   * over req.body (which may have been stripped by whitelist:true).
   */
  private getBody(req: any): any {
    return req.__scimBody || req.body;
  }

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
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.createUser(this.getBody(req), this.getBaseUrl(req));
  }

  @Put('Users/:id')
  async replaceUser(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.replaceUser(id, this.getBody(req), this.getBaseUrl(req));
  }

  @Patch('Users/:id')
  async patchUser(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.patchUser(id, this.getBody(req) as ScimPatchRequest, this.getBaseUrl(req));
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
