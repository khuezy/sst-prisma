import { StackContext } from '@serverless-stack/resources';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { envVar, secret as secretEnv } from 'common';
import { makeDatabaseUrl } from './database';

export function Secrets({ stack, app }: StackContext) {
  const secret = new Secret(stack, 'Secret', {
    description: app.logicalPrefixedName('app'),
    generateSecretString: {
      secretStringTemplate: JSON.stringify({
        // DB URL in secrets
        [secretEnv('DATABASE_URL')]: makeDatabaseUrl(),
      }),
      generateStringKey: secretEnv('APP'),
    },
  });

  app.addDefaultFunctionEnv({
    [envVar('APP_SECRET_ARN')]: secret.secretArn,
  });
  app.addDefaultFunctionPermissions([[secret, 'grantRead']]);

  return { secret };
}
