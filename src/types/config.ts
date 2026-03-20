export interface AuthCoreConfig {
  jwt: {
    secret: string;
    accessExpiration?: string; // default '15m'
    refreshExpiration?: string; // default '7d'
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    prefix?: string; // default 'auth:'
  };
  keycloak?: {
    serverUrl: string;
    publicUrl?: string;
    realm: string;
  };
  azureAd?: {
    tenantId: string;
    clientId: string;
  };
  portal?: {
    url: string;
    audience: string;
  };
  fileAuth?: {
    usersFile: string; // path to JSON file
    enabled: boolean; // force false in production
  };
  scim?: {
    enabled: boolean;
    bearerToken: string;
  };
}

export interface FileUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}
