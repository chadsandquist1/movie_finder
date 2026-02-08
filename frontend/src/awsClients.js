import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { loggedSend } from './logger';

const REGION = import.meta.env.VITE_AWS_REGION;
const USER_POOL_ID = import.meta.env.VITE_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;
const LAMBDA_FUNCTION_NAME = import.meta.env.VITE_LAMBDA_FUNCTION_NAME;

const providerKey = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

export async function login(username, password) {
  // Step 1: InitiateAuth — get tokens
  const cognitoProvider = new CognitoIdentityProviderClient({ region: REGION });
  const authResult = await loggedSend(
    cognitoProvider,
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    })
  );

  const idToken = authResult.AuthenticationResult.IdToken;

  // Step 2: GetId — exchange token for identity
  const cognitoIdentity = new CognitoIdentityClient({ region: REGION });
  const idResult = await loggedSend(
    cognitoIdentity,
    new GetIdCommand({
      IdentityPoolId: IDENTITY_POOL_ID,
      Logins: { [providerKey]: idToken },
    })
  );

  const identityId = idResult.IdentityId;

  // Step 3: GetCredentialsForIdentity — get temp AWS creds
  const credsResult = await loggedSend(
    cognitoIdentity,
    new GetCredentialsForIdentityCommand({
      IdentityId: identityId,
      Logins: { [providerKey]: idToken },
    })
  );

  const { AccessKeyId, SecretKey, SessionToken } = credsResult.Credentials;

  return {
    identityId,
    credentials: { accessKeyId: AccessKeyId, secretAccessKey: SecretKey, sessionToken: SessionToken },
  };
}

export async function invokeLambda(credentials) {
  const lambdaClient = new LambdaClient({
    region: REGION,
    credentials,
  });

  const result = await loggedSend(
    lambdaClient,
    new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
    })
  );

  const payload = new TextDecoder().decode(result.Payload);
  return payload;
}
