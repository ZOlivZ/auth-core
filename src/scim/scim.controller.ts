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
import { Public } from '../decorators/public';
import { SCIM_CONTENT_TYPE, type ScimPatchRequest } from './scim.dto';

/**
 * SCIM 2.0 Users controller.
 *
 * @Public() — tells global auth guards (JWT, roles) to skip these routes.
 * SCIM has its own ScimBearerGuard for authentication.
 *
 * Uses @Req().body — bypasses global ValidationPipe (whitelist:true strips
 * undecorated fields). The ScimModule registers an Express JSON middleware
 * for application/scim+json so req.body is always populated.
 */
@Controller('scim/v2')
@Public()
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
    return this.scimService.listUsers(
      this.getBaseUrl(req),
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
    return this.scimService.createUser(req.body, this.getBaseUrl(req));
  }

  @Put('Users/:id')
  async replaceUser(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.replaceUser(id, req.body, this.getBaseUrl(req));
  }

  @Patch('Users/:id')
  async patchUser(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    this.setScimContentType(res);
    return this.scimService.patchUser(id, req.body as ScimPatchRequest, this.getBaseUrl(req));
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
