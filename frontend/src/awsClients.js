import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { loggedSend } from './logger';

export async function fetchConfig() {
  const res = await fetch('/config.json');
  if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
  return res.json();
}

export async function login(config, username, password) {
  const { region, userPoolId, clientId } = config;

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

  // Handle NEW_PASSWORD_REQUIRED challenge
  if (authResult.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    const err = new Error('NEW_PASSWORD_REQUIRED');
    err.challengeName = 'NEW_PASSWORD_REQUIRED';
    err.session = authResult.Session;
    err.username = username;
    throw err;
  }

  const idToken = authResult.AuthenticationResult.IdToken;

  return {
    username,
    idToken,
  };
}

export async function completeNewPassword(config, username, newPassword, session) {
  const { region, clientId } = config;

  const cognitoProvider = new CognitoIdentityProviderClient({ region });
  const challengeResult = await loggedSend(
    cognitoProvider,
    new RespondToAuthChallengeCommand({
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      ClientId: clientId,
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: newPassword,
      },
    })
  );

  const idToken = challengeResult.AuthenticationResult.IdToken;

  return {
    username,
    idToken,
  };
}

export async function apiCall(baseUrl, idToken, method, path, body) {
  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}
