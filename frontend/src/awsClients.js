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

export async function fetchConfig() {
  const res = await fetch('/config.json');
  if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
  return res.json();
}

export async function login(config, username, password) {
  const { region, userPoolId, clientId, identityPoolId } = config;
  const providerKey = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  // Step 1: InitiateAuth — get tokens
  const cognitoProvider = new CognitoIdentityProviderClient({ region });
  const authResult = await loggedSend(
    cognitoProvider,
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    })
  );

  const idToken = authResult.AuthenticationResult.IdToken;

  // Step 2: GetId — exchange token for identity
  const cognitoIdentity = new CognitoIdentityClient({ region });
  const idResult = await loggedSend(
    cognitoIdentity,
    new GetIdCommand({
      IdentityPoolId: identityPoolId,
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

export async function invokeLambda(config, credentials, functionName, payload) {
  const lambdaClient = new LambdaClient({
    region: config.region,
    credentials,
  });

  const params = { FunctionName: functionName };
  if (payload !== undefined) {
    params.Payload = new TextEncoder().encode(JSON.stringify(payload));
  }

  const result = await loggedSend(
    lambdaClient,
    new InvokeCommand(params)
  );

  const responsePayload = new TextDecoder().decode(result.Payload);
  return responsePayload;
}
