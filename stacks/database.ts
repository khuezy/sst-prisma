import { RDS, StackContext, use } from '@serverless-stack/resources';

import { Duration } from 'aws-cdk-lib';
import { APP_NAME, envVar } from 'common';
import { Network } from 'stacks/network';
import { IS_PRODUCTION } from './config';
import { DbMigrationScript } from './resources/migrationScript';

export function Database({ stack, app }: StackContext) {
  const net = use(Network);

  const defaultDatabaseName = APP_NAME;
  const rds = new RDS(stack, 'DB', {
    cdk: { cluster: { vpc: net.vpc } },
    engine: 'postgresql10.14',
    defaultDatabaseName,
    scaling: {
      autoPause: IS_PRODUCTION ? false : Duration.hours(10).toMinutes(),
      minCapacity: 'ACU_2',
      maxCapacity: 'ACU_4',
    },
  });

  rds.cdk.cluster.connections.allowDefaultPortFrom(
    net.defaultLambdaSecurityGroup,
    'Allow access from lambda functions'
  );

  app.addDefaultFunctionEnv({
    [envVar('DATABASE')]: defaultDatabaseName,
    [envVar('CLUSTER_ARN')]: rds.clusterArn,
    [envVar('DB_SECRET_ARN')]: rds.secretArn,
  });
  app.addDefaultFunctionPermissions([rds]);

  // DB connection for local dev can be overridden
  const localDatabaseUrl = process.env[envVar('DATABASE_URL')];
  if (process.env.IS_LOCAL_DEV && localDatabaseUrl) {
    app.addDefaultFunctionEnv({
      [envVar('DATABASE_URL')]: localDatabaseUrl,
    });
  }

  // DB migrations
  new DbMigrationScript(stack, 'MigrationScript', { vpc: net.vpc });

  return { rds, defaultDatabaseName };
}

/**
 * Generate a database connection string (DSN).
 */
export function makeDatabaseUrl() {
  const prismaConnectionLimit = process.env.PRISMA_CONNECTION_LIMIT || 5;

  const rds = use(Database);
  const dbUsername = rds.rds.cdk.cluster.secret?.secretValueFromJson('username');
  const dbPassword = rds.rds.cdk.cluster.secret?.secretValueFromJson('password');

  return `postgresql://${dbUsername}:${dbPassword}@${rds.rds.cdk.cluster.clusterEndpoint.hostname}/${rds.defaultDatabaseName}?connection_limit=${prismaConnectionLimit}`;
}
