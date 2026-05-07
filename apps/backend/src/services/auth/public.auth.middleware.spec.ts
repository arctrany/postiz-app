import { HttpStatus } from '@nestjs/common';
import { PublicAuthMiddleware } from './public.auth.middleware';

describe('PublicAuthMiddleware', () => {
  const createResponse = () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();

    return { status, json };
  };

  it('strips a Bearer prefix before API key lookup', async () => {
    const org = { id: 'org_1', subscription: { id: 'sub_1' } };
    const organizationService = {
      getOrgByApiKey: jest.fn().mockResolvedValue(org),
    };
    const oauthService = {
      getOrgByOAuthToken: jest.fn(),
    };
    const middleware = new PublicAuthMiddleware(
      organizationService as any,
      oauthService as any
    );
    const response = createResponse();
    const next = jest.fn();
    const request = {
      headers: {
        authorization: 'Bearer api_key_123',
      },
    } as any;

    await middleware.use(request, response as any, next);

    expect(organizationService.getOrgByApiKey).toHaveBeenCalledWith(
      'api_key_123'
    );
    expect(oauthService.getOrgByOAuthToken).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
    expect(request.org).toEqual({
      ...org,
      users: [{ users: { role: 'SUPERADMIN' } }],
    });
    expect(next).toHaveBeenCalled();
  });

  it('strips a Bearer prefix before OAuth token lookup', async () => {
    const authorization = {
      organization: { id: 'org_2', subscription: { id: 'sub_2' } },
    };
    const organizationService = {
      getOrgByApiKey: jest.fn(),
    };
    const oauthService = {
      getOrgByOAuthToken: jest.fn().mockResolvedValue(authorization),
    };
    const middleware = new PublicAuthMiddleware(
      organizationService as any,
      oauthService as any
    );
    const response = createResponse();
    const next = jest.fn();
    const request = {
      headers: {
        authorization: 'Bearer pos_token_123',
      },
    } as any;

    await middleware.use(request, response as any, next);

    expect(oauthService.getOrgByOAuthToken).toHaveBeenCalledWith(
      'pos_token_123'
    );
    expect(organizationService.getOrgByApiKey).not.toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
    expect(request.org).toEqual({
      ...authorization.organization,
      users: [{ users: { role: 'SUPERADMIN' } }],
    });
    expect(next).toHaveBeenCalled();
  });

  it('returns unauthorized when the header contains only Bearer', async () => {
    const organizationService = {
      getOrgByApiKey: jest.fn(),
    };
    const oauthService = {
      getOrgByOAuthToken: jest.fn(),
    };
    const middleware = new PublicAuthMiddleware(
      organizationService as any,
      oauthService as any
    );
    const response = createResponse();
    const next = jest.fn();
    const request = {
      headers: {
        authorization: 'Bearer   ',
      },
    } as any;

    await middleware.use(request, response as any, next);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(response.json).toHaveBeenCalledWith({ msg: 'No API Key found' });
    expect(organizationService.getOrgByApiKey).not.toHaveBeenCalled();
    expect(oauthService.getOrgByOAuthToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
